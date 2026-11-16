import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
from service import Monitor, demo_snapshot, evaluate, ollama_report

HAS_NODE = shutil.which("node") is not None


def fake_motor(nivel, regla=None, faltan=None, total=None):
    """Stands in for motor/cli.mjs so these tests do not depend on Node."""
    return lambda vitals: {"nivel": nivel, "regla": regla, "faltan": faltan or [],
                           "news2": {"total": total}, "version": "test"}


class MonitorTests(unittest.TestCase):
    def test_alert_is_persisted_without_calling_llm(self):
        with tempfile.TemporaryDirectory() as tmp:
            def unavailable(*args):
                raise TimeoutError()
            assessor = lambda snap: evaluate(snap, motor=fake_motor("PRIORITY", "R03", total=4))
            monitor = Monitor(Path(tmp) / "test.db", reporter=unavailable, assessor=assessor)
            result = monitor.ingest(demo_snapshot("A", 19, 12))
            self.assertEqual(result["status"], "PRIORITY")
            self.assertEqual(result["motor"], "motor/evaluar.mjs")
            self.assertIsNone(monitor.state()["items"][0]["report"])
            monitor.report_cycle()
            report = monitor.state()["items"][0]["report"]
            self.assertEqual(report["llmStatus"], "fallback")
            self.assertEqual(report["assessment"]["status"], "PRIORITY")
            self.assertIn("review", report["recommendation_ids"])

    def test_level_comes_from_engine_and_trends_are_separate(self):
        sample = demo_snapshot("A", 0, 2)
        self.assertTrue(all((r["day"], r["hour"]) <= (0, 2) for r in sample["recentVitals"]))
        self.assertTrue(all(r["day"] <= 0 for r in sample["dailyContext"]))
        sample["vitals"].update(hr_z=5)
        result = evaluate(sample, motor=fake_motor(None))
        self.assertEqual(result["status"], "SIN_CLASIFICAR")  # A trend never sets the level.
        self.assertEqual(result["events"], [])
        self.assertTrue(result["trend_events"])
        self.assertIn("verify", result["recommendation_ids"])
        missing = evaluate(sample, motor=fake_motor("INSUFFICIENT DATA", "R19", ["spo2"]))
        self.assertEqual(missing["status"], "INSUFFICIENT DATA")
        self.assertIn("Medir de nuevo", missing["events"][0])
        self.assertEqual(missing["recommendation_ids"][0], "update")
        down = evaluate(sample, motor=lambda v: {"error": "motor_no_disponible"})
        self.assertEqual(down["status"], "MOTOR_NO_DISPONIBLE")
        self.assertTrue(down["events"])

    @unittest.skipUnless(HAS_NODE, "Requiere Node.js para ejecutar el motor oficial")
    def test_official_engine_end_to_end(self):
        sample = demo_snapshot("A", 0, 2)
        sample["vitals"].update(hr=135, rr=26, spo2=91, alert=True, on_oxygen=False)
        result = evaluate(sample)
        self.assertEqual(result["status"], "EMERGENCY")
        self.assertEqual(result["regla"], "R01")
        sample["vitals"]["sbp"] = None
        result = evaluate(sample)
        self.assertEqual(result["status"], "INSUFFICIENT DATA")
        self.assertIn("sbp", result["faltan"])

    def test_invalid_output_is_rejected(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, *args):
                return json.dumps({"done": True, "message": {"content": json.dumps({
                    "summary": "Texto", "recommendation_ids": ["prescribe"]})}}).encode()
        with patch("service.urlopen", return_value=Response()):
            with self.assertRaises(ValueError):
                ollama_report({}, {"recommendation_ids": []}, "test")

    def test_llm_cannot_remove_mandatory_recommendations(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, *args):
                return json.dumps({"done": True, "message": {"content": json.dumps({
                    "summary": "Muestra simulada", "recommendation_ids": ["record"]})}}).encode()
        with patch("service.urlopen", return_value=Response()):
            result = ollama_report({}, {"recommendation_ids": ["verify", "review"]}, "test")
        self.assertEqual(result["recommendation_ids"], ["verify", "review", "record"])

    def test_reports_are_scheduled_every_300_seconds_without_sleeping(self):
        clock = [0.0]
        waits, cycles = [], []
        class Wake:
            def wait(self, seconds):
                waits.append(seconds)
                if len(waits) == 3:
                    raise InterruptedError("End test")
                clock[0] += seconds
            def clear(self): pass
        with tempfile.TemporaryDirectory() as tmp:
            monitor = Monitor(Path(tmp) / "test.db")
            monitor.wake = Wake()
            monitor.report_cycle = lambda: cycles.append(clock[0])
            with patch("service.time.monotonic", side_effect=lambda: clock[0]):
                with self.assertRaises(InterruptedError):
                    monitor.run()
        self.assertEqual(cycles, [0, 300])
        self.assertEqual(waits, [0, 300, 300])

    def test_restart_recovers_and_new_sample_does_not_show_old_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "test.db"
            monitor = Monitor(path, reporter=lambda *args: {"summary": "Demo", "recommendation_ids": []},
                              assessor=lambda snap: evaluate(snap, motor=fake_motor(None)))
            monitor.ingest(demo_snapshot("B", 0, 0))
            monitor.report_cycle()
            self.assertIsNotNone(Monitor(path).state()["items"][0]["report"])
            monitor.ingest(demo_snapshot("B", 1, 0))
            self.assertIsNone(monitor.state()["items"][0]["report"])


if __name__ == "__main__":
    unittest.main()
