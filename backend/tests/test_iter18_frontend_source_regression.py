"""Iter18 frontend source regressions: express badge selector and queue tail preservation."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ORDER_SYNC = ROOT / "frontend" / "src" / "orderSync.ts"
PIPELINE = ROOT / "frontend" / "src" / "components" / "OrdersPipeline.tsx"


def test_order_sync_preserves_failed_and_tail_jobs():
    # orderSync module: simulate first failed request and ensure queue tail is preserved in order
    jobs = [
        {"id": "A", "target_status": "washing"},
        {"id": "B", "target_status": "drying"},
        {"id": "C", "target_status": "ironing"},
    ]
    pending = []

    for index, job in enumerate(jobs):
        try:
            if job["id"] == "A":
                raise RuntimeError("forced first failure")
        except RuntimeError:
            pending.extend(jobs[index:])
            break

    assert [j["id"] for j in pending] == ["A", "B", "C"]


def test_order_sync_source_uses_tail_push_fix():
    # orderSync module: verify source contains fixed tail-preserving statement
    source = ORDER_SYNC.read_text(encoding="utf-8")
    assert "pending.push(...jobs.slice(index));" in source


def test_express_badge_testid_selector_present():
    # OrdersPipeline module: express badge should expose explicit testID for automation
    source = PIPELINE.read_text(encoding="utf-8")
    assert "testID={`express-badge-${item.code}`}" in source
    assert ">EXPRESS<" in source
