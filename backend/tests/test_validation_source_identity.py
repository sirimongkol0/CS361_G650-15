import importlib.util
from pathlib import Path
import subprocess


def test_source_archive_identity_is_repeatable_and_tracks_edits(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location('v2_validation', Path(__file__).resolve().parents[2] / 'scripts/prepare_v2_validation.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, 'ROOT', tmp_path)
    for name in ['frontend/package.json', 'frontend/package-lock.json', 'frontend/next.config.js', 'backend/requirements.txt', 'backend/main.py']:
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('original', encoding='utf-8')
    def no_git(*args, **kwargs):
        raise subprocess.CalledProcessError(128, 'git')
    monkeypatch.setattr(module.subprocess, 'check_output', no_git)
    identity = module.source_identity()
    assert identity['sourceCommit'] is None
    assert identity['sourceIdentityKind'] == 'source_archive'
    assert len(identity['sourceFingerprint']) == 64
    assert module.source_identity() == identity
    (tmp_path / 'backend/main.py').write_text('changed', encoding='utf-8')
    assert module.source_identity()['sourceFingerprint'] != identity['sourceFingerprint']
