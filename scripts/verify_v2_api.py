"""Read-only V2 API smoke check. Does not seed, upload, or change records."""

import argparse
import json
from urllib.request import urlopen


def verify(api):
    def get(path):
        with urlopen(f"{api.rstrip('/')}/{path}", timeout=30) as response:
            assert response.status == 200, path
            return response.read(), response.headers

    def get_json(path):
        return json.loads(get(path)[0])

    assert get_json('health') == {'status': 'healthy'}
    partners = get_json('partners/')
    documents = get_json('documents/')
    activities = get_json('activities/')
    assert partners and documents and activities, 'Expected seeded data for all three features'
    partner_ids = {p['id'] for p in partners}
    document_ids = {d['id'] for d in documents}
    downloads = 0
    # Representative detail requests; validate links for every list row below.
    for partner in partners[:3]:
        assert get_json(f"partners/{partner['id']}")['id'] == partner['id']
    for document in documents:
        assert {'fileName', 'uploadedAt', 'scopeItems'} <= document.keys()
        assert 'timelineSteps' not in document
        assert document['partnerId'] is None or document['partnerId'] in partner_ids
        if document['storageKey']:
            data, headers = get(f"documents/{document['id']}/download")
            assert data.startswith(b'%PDF-'), 'Expected PDF bytes'
            assert headers.get_content_type() == 'application/pdf'
            if document['sizeBytes'] is not None:
                assert len(data) == document['sizeBytes']
            downloads += 1
    assert downloads, 'Expected at least one downloadable PDF'
    for activity in activities[:3]:
        assert get_json(f"activities/{activity['id']}")['id'] == activity['id']
    for activity in activities:
        assert activity['partner'] is None or activity['partner']['id'] in partner_ids
        assert activity['mouDocId'] is None or activity['mouDocId'] in document_ids
    return {
        'partners': len(partners), 'documents': len(documents),
        'activities': len(activities), 'pdf_downloads': downloads,
        'activities_with_agreement': sum(a['mouDocId'] is not None for a in activities),
        'activities_without_agreement': sum(a['mouDocId'] is None for a in activities),
        'status': 'passed',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api', default='http://localhost:8000/api/v1')
    args = parser.parse_args()
    print(json.dumps(verify(args.api), indent=2))
