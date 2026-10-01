"""Upload only packaged fictional PDFs to content-addressed demo S3 keys.

Uses the existing .env S3 configuration or AWS credential chain. No DB changes,
bucket creation, ACL changes, deletion, or writes outside cstu-demo/v2/.
"""
import hashlib
import json
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def main():
    values = dotenv_values(ROOT / '.env')
    bucket = values.get('S3_BUCKET')
    if not bucket:
        raise SystemExit('S3_BUCKET is missing; configure an existing demo bucket first')
    session = boto3.Session(
        aws_access_key_id=values.get('AWS_ACCESS_KEY_ID') or None,
        aws_secret_access_key=values.get('AWS_SECRET_ACCESS_KEY') or None,
        aws_session_token=values.get('AWS_SESSION_TOKEN') or None,
        region_name=values.get('AWS_REGION') or 'ap-southeast-1',
    )
    client = session.client('s3', config=Config(connect_timeout=5, read_timeout=15,
                                             retries={'max_attempts': 1}))
    directory = ROOT / 'backend/fixtures/demo-documents'
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    report = {'bucket': bucket, 'objects': [], 'status': 'pending'}
    report_dir = ROOT / '.tmp-demo-enrichment'
    report_dir.mkdir(exist_ok=True)
    try:
        for item in manifest.values():
            data = (directory / item['file']).read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if digest != item['sha256'] or not data.startswith(b'%PDF'):
                raise RuntimeError('PDF verification failed before upload')
            key = f"cstu-demo/v2/{digest}/{item['file']}"
            # Content-addressing makes repeat uploads identical. Never use real-data keys.
            client.put_object(Bucket=bucket, Key=key, Body=data,
                              ContentType='application/pdf', ServerSideEncryption='AES256',
                              Metadata={'sha256': digest, 'data-kind': 'fictional-demo'})
            received = client.get_object(Bucket=bucket, Key=key)['Body'].read()
            if hashlib.sha256(received).hexdigest() != digest:
                raise RuntimeError('S3 download hash does not match packaged PDF')
            report['objects'].append({'key': key, 'sha256': digest, 'sizeBytes': len(data)})
            print('Verified fictional PDF:', item['file'])
        report['status'] = 'passed'
    except ClientError as error:
        report['status'] = 'blocked'
        report['awsErrorCode'] = error.response['Error']['Code']
        report['operation'] = error.operation_name
        print('S3 upload blocked:', report['operation'], report['awsErrorCode'])
    finally:
        (report_dir / 's3-upload.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
