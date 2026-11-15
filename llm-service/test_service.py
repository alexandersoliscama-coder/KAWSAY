import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from service import Monitor, demo_snapshot, evaluate, ollama_report


class MonitorTests(unittest.TestCase):
    def test_alert_is_persisted_without_calling_llm(self):
        with tempfile.TemporaryDirectory() as tmp:
            def unavailable(*args):
                raise TimeoutError()
            monitor = Monitor(Path(tmp) / "test.db", reporter=unavailable)
            sample = demo_snapshot("A", 19, 12)
            sample["vitals"]["hr_z"] = 5
            result = monitor.ingest(sample)
            self.assertEqual(result["status"], "aviso_demo")
            self.assertIsNone(monitor.state()["items"][0]["report"])
            monitor.report_cycle()
            report = monitor.state()["items"][0]["report"]
            self.assertEqual(report["llmStatus"], "fallback")
            self.assertEqual(report["assessment"]["status"], "aviso_demo")
            self.assertIn("review", report["recommendation_ids"])

    def test_no_future_context_and_alert_is_alertness(self):
        sample = demo_snapshot("A", 0, 2)
        self.assertTrue(all((r["day"], r["hour"]) <= (0, 2) for r in sample["recentVitals"]))
        self.assertTrue(all(r["day"] <= 0 for r in sample["dailyContext"]))
        sample["vitals"].update(hr_z=0, rr_z=0, spo2_z=0, temp_z=0, alert=True)
        self.assertEqual(evaluate(sample)["status"], "sin_aviso_demo")
        sample["vitals"]["hr_z"] = None
        self.assertEqual(evaluate(sample)["status"], "datos_insuficientes")
        sample["vitals"]["spo2_z"] = -4
        self.assertEqual(evaluate(sample)["status"], "aviso_demo")

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
            monitor = Monitor(path, reporter=lambda *args: {"summary": "Demo", "recommendation_ids": []})
            monitor.ingest(demo_snapshot("B", 0, 0))
            monitor.report_cycle()
            self.assertIsNotNone(Monitor(path).state()["items"][0]["report"])
            monitor.ingest(demo_snapshot("B", 1, 0))
            self.assertIsNone(monitor.state()["items"][0]["report"])


if __name__ == "__main__":
    unittest.main()
