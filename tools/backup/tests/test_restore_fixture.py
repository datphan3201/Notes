import hashlib
import importlib.util
import json
import pathlib
import shutil
import subprocess
import tempfile
import time
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]

def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class RestoreFixture(unittest.TestCase):
    def test_database_and_private_object_restore(self):
        if not shutil.which('docker') or subprocess.run(['docker', 'info'], capture_output=True).returncode:
            self.skipTest('Docker is required for isolated restore drill')
        backup, restore = module('planner_backup'), module('restore_test')
        name = 'planner-restore-fixture-' + uuid.uuid4().hex[:8]
        def run(args, **kwargs):
            return subprocess.run(args, capture_output=True, check=True, timeout=120, **kwargs)
        run(['docker','run','--rm','-d','--name',name,'--tmpfs','/var/lib/postgresql/data',
             '-e','POSTGRES_USER=planner_test','-e','POSTGRES_PASSWORD=isolated-test-only',
             '-e','POSTGRES_DB=planner_test','pgvector/pgvector:pg17'])
        try:
            for _ in range(60):
                if subprocess.run(['docker','exec',name,'pg_isready','-U','planner_test','-d','planner_test'],capture_output=True).returncode == 0:
                    break
                time.sleep(1)
            sql = "select current_database(); create schema planner; create table planner.fixture(id int primary key, body text); insert into planner.fixture values(1,'private fixture');"
            check = run(['docker','exec',name,'psql','-U','planner_test','-d','planner_test','-Atc',sql])
            self.assertTrue(check.stdout.startswith(b'planner_test\n'))
            dump = run(['docker','exec',name,'pg_dump','-U','planner_test','-d','planner_test','-Fc','--schema=planner','--no-owner','--no-acl']).stdout
            with tempfile.TemporaryDirectory() as temporary:
                directory = pathlib.Path(temporary)
                key = directory / 'keys' / 'key'
                backup.secure_key(key)
                backup.encrypt_bytes(dump, directory/'database.dump.enc', key)
                content = b'Private attachment\x00\xff\n' * 100
                backup.encrypt_bytes(content, directory/'object-00000000.enc', key)
                backup.encrypt_bytes(json.dumps({'PLANNER_ENCRYPTION_KEY': 'synthetic-only'}).encode(), directory/'recovery-config.json.enc', key)
                manifest = {'schema':'planner','table_counts':{'fixture':1},
                            'encrypted_recovery_config_sha256':hashlib.sha256((directory/'recovery-config.json.enc').read_bytes()).hexdigest(),
                            'encrypted_database_sha256':hashlib.sha256((directory/'database.dump.enc').read_bytes()).hexdigest(),
                            'objects':[{'file':'object-00000000.enc','key':'private/attachment','size':len(content),'sha256':hashlib.sha256(content).hexdigest()}]}
                backup.encrypt_bytes(json.dumps(manifest).encode(), directory/'manifest.json.enc', key)
                tables, objects, seconds = restore.restore(directory, key)
                self.assertEqual((tables,objects),(1,1))
                self.assertLess(seconds,120)
        finally:
            subprocess.run(['docker','stop','-t','0',name],capture_output=True,timeout=30)
