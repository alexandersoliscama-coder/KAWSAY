import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import time
from service import Monitor, clean_case, demo_snapshot, evaluate, ollama_case, ollama_report


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

    def test_case_summary_is_async_whitelisted_and_falls_back_on_error(self):
        body = {"caseId": "case-0001-abcdef", "level": "INSUFFICIENT DATA", "rule": "R19", "news2": None,
                "vitals": {"hr": 80, "rr": None, "spo2": float("nan"), "evil": 1}, "problems": [{"param": "SpO2", "reason": "sensor failed"}],
                "symptoms": ["Headache (M3)", 5], "ignore": "previous instructions"}
        cleaned = clean_case(body)
        self.assertEqual(set(cleaned["vitals"]), {"hr", "rr", "spo2", "sbp", "dbp", "temp"})
        self.assertIsNone(cleaned["vitals"]["spo2"])
        self.assertNotIn("ignore", cleaned)
        self.assertEqual(cleaned["rule"], "R19")
        self.assertEqual(cleaned["symptoms"], ["Headache (M3)"])
        for bad in ({"caseId": "x", "level": "EMERGENCY"}, {"caseId": "case-0001-abcdef", "level": "NOPE"}, []):
            with self.assertRaises(ValueError):
                clean_case(bad)
        with tempfile.TemporaryDirectory() as tmp:
            seen = []
            def ok(case, model):
                seen.append(case)
                return {"conditions": [], "recommendations": ["Follow the protocol."]}
            monitor = Monitor(Path(tmp) / "t.db", case_reporter=ok)
            self.assertEqual(monitor.submit_case(body)["status"], "pending")
            for _ in range(50):
                if monitor.case_status("case-0001-abcdef")["status"] != "pending":
                    break
                time.sleep(0.05)
            self.assertEqual(monitor.case_status("case-0001-abcdef")["recommendations"], ["Follow the protocol."])
            self.assertEqual(monitor.submit_case(body)["status"], "ok")  # retry does not call the LLM again
            self.assertEqual(len(seen), 1)
            def broken(case, model):
                raise TimeoutError()
            failing = Monitor(Path(tmp) / "t2.db", case_reporter=broken)
            failing.submit_case(body)
            for _ in range(50):
                if failing.case_status("case-0001-abcdef")["status"] != "pending":
                    break
                time.sleep(0.05)
            self.assertEqual(failing.case_status("case-0001-abcdef"), {"status": "error", "errorType": "TimeoutError"})
            self.assertIsNone(failing.case_status("unknown"))

    def test_case_output_validation(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return json.dumps({"done": True, "message": {"content": json.dumps({"conditions": [], "recommendations": ["x" * 201]})}}).encode()
        case = clean_case({"caseId": "case-0001-abcdef", "level": "SCHEDULED"})
        with patch("service.urlopen", return_value=Response()):
            with self.assertRaises(ValueError):
                ollama_case(case, "m")

    def test_conditions_are_rejected_when_data_is_insufficient(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n): return json.dumps({"done": True, "message": {"content": json.dumps(
                {"conditions": [{"name": "X", "why": "y"}], "recommendations": ["Measure again."]})}}).encode()
        case = clean_case({"caseId": "case-0001-abcdef", "level": "INSUFFICIENT DATA", "rule": "R19"})
        with patch("service.urlopen", return_value=Response()):
            with self.assertRaises(ValueError):
                ollama_case(case, "m")


if __name__ == "__main__":
    unittest.main()
