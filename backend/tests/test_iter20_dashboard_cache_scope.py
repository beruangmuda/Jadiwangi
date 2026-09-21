"""Iter20 frontend cache-scope regression guards for process/dashboard updates."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PROSES_SCREEN = ROOT / "frontend" / "app" / "proses" / "[id].tsx"
EMPLOYEE_HOME = ROOT / "frontend" / "app" / "(employee)" / "index.tsx"


def test_process_screen_updates_exact_outlet_dashboard_key():
    """Process screen must optimistically update only current outlet dashboard cache key."""
    source = PROSES_SCREEN.read_text(encoding="utf-8")
    assert 'qc.setQueryData(["dashboard", session?.currentOutletId]' in source
    assert 'qc.setQueriesData({ queryKey: ["dashboard"] }' not in source


def test_employee_dashboard_contains_required_stat_testids():
    """Employee dashboard cards should expose deterministic testIDs for UI automation."""
    source = EMPLOYEE_HOME.read_text(encoding="utf-8")
    assert 'testID="in-progress-card"' in source
    assert 'testID="ready-orders-card"' in source
