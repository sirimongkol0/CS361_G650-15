# คู่มือ Login และสิทธิ์ตามบทบาท (V3)

สำหรับทีมที่ทำงาน V3-2 ถึง V3-4 อธิบายว่าระบบ login ทำงานอย่างไร
วิธีป้องกัน endpoint ด้วย `require_role` วิธีเขียน test ตามบทบาท และวิธีรันในเครื่อง
บทบาทไหนทำอะไรได้ ดูที่ [ตารางสิทธิ์ตามบทบาท](../decisions/v3-role-permissions.md)

## ระบบทำงานอย่างไร

เราไม่เก็บรหัสผ่านเอง Amazon Cognito (User Pool `cstu-v3-auth`) เป็นผู้เก็บบัญชีและตรวจรหัสผ่าน

1. ผู้ใช้กรอกอีเมล/รหัสผ่านที่หน้า `/login` เว็บเรียก `POST /api/v1/auth/login`
2. backend ส่งไปให้ Cognito ตรวจ ถ้าถูกต้องจะได้ access token (อายุ 60 นาที)
3. token มีบทบาทของผู้ใช้ (group ใน Cognito): `public`, `student`, `coordinator`, `staff`, `admin`
4. เว็บแนบ `Authorization: Bearer <token>` ทุกครั้งที่เรียก API
   backend ตรวจลายเซ็นของ token กับ public key ของ Cognito แล้วตรวจบทบาท
5. `POST /api/v1/auth/logout` เพิกถอน token ใบนั้นทันที (ตาราง `revoked_tokens`)

| สถานการณ์ | ผลลัพธ์ |
|---|---|
| ไม่มี token / token ผิด / หมดอายุ / logout แล้ว | 401 |
| token ถูกต้องแต่บทบาทไม่อยู่ในรายการที่อนุญาต | 403 |
| บัญชีถูกปิด (`users.is_active = false`) | 403 |
| ยังไม่ได้ตั้งค่า Cognito ใน backend | `/auth/*` ตอบ 503 ส่วน API อื่นทำงานปกติ |
| GET ข้อมูลสาธารณะเดิม | ไม่ต้องมี token เหมือนเดิม |

ตาราง `users` เก็บเฉพาะ `cognito_sub`, `email`, `role`, `is_active` ไม่มีรหัสผ่าน
แถวถูกสร้างตอน login ครั้งแรก และ `role` อัปเดตตาม group ใน Cognito ทุกครั้งที่ตรวจ token

ปุ่มบนเว็บซ่อนตามบทบาท (`canManage` ใน `frontend/src/lib/role-context.tsx`) เพื่อความสะดวกเท่านั้น
**ทุก endpoint ที่เขียนข้อมูลต้องตรวจสิทธิ์ที่ backend เสมอ**

## ป้องกัน endpoint ด้วย `require_role`

```python
from fastapi import Depends
import models
from auth import require_role

@router.post("/partners")
def create_partner(
    body: schemas.PartnerCreate,
    db: Session = Depends(database.get_db),
    user: models.User = Depends(require_role("coordinator", "staff", "admin")),
):
    ...  # user คือผู้ที่ login อยู่ ใช้ user.id เป็นเจ้าของรายการหรือบันทึกใน audit log
```

- ใส่บทบาทที่อนุญาตให้ครบ **admin ไม่ได้สิทธิ์อัตโนมัติ** ต้องใส่ `"admin"` เอง
- ชื่อบทบาทผิด (เช่น `"Staff"`) จะ error ตั้งแต่ตอน import ไม่ใช่ตอนรัน
- ถ้าต้องการแค่ "login แล้ว" ไม่สนบทบาท ใช้ `Depends(auth.get_current_user)`
- กรณี "เฉพาะรายการที่ตนรับผิดชอบ" ให้ `require_role` ตรวจบทบาทก่อน
  แล้วเทียบ `owner_user_id` ของรายการกับ `user.id` ในโค้ดของ endpoint ถ้าไม่ตรงให้ตอบ 403

## เขียน test ตามบทบาท

`backend/tests/conftest.py` มี fixture ให้ใช้ ไม่ต้องต่อ AWS จริง (CI ไม่มี AWS secret)

- `auth_headers(role)` คืน header ของผู้ใช้ที่ login ด้วยบทบาทนั้น
- `auth_headers(role, name="other")` ผู้ใช้คนที่สองของบทบาทเดียวกัน ใช้ทดสอบเรื่องเจ้าของรายการ
- `.user_id` ของผลลัพธ์คือ `users.id` ของผู้ใช้นั้น

```python
import pytest

@pytest.mark.parametrize("role,status", [
    ("public", 403), ("student", 403),
    ("coordinator", 201), ("staff", 201), ("admin", 201),
])
def test_create_partner_by_role(client, auth_headers, role, status):
    response = client.post("/api/v1/partners/", json={"name": "ตัวอย่าง"}, headers=auth_headers(role))
    assert response.status_code == status


def test_create_partner_without_login_is_401(client):
    assert client.post("/api/v1/partners/", json={"name": "ตัวอย่าง"}).status_code == 401


def test_coordinator_cannot_edit_someone_elses_partner(client, auth_headers):
    owner, other = auth_headers("coordinator"), auth_headers("coordinator", name="other")
    created = client.post("/api/v1/partners/", json={"name": "ตัวอย่าง"}, headers=owner).json()
    response = client.put(f"/api/v1/partners/{created['id']}", json={"name": "แก้"}, headers=other)
    assert response.status_code == 403
```

ต้องการ token แบบพิเศษ (หมดอายุ ลายเซ็นปลอม ฯลฯ) ใช้ `make_token` จาก `tests/auth_helpers.py`
ดูตัวอย่างใน `tests/test_auth.py`

## รันในเครื่อง

1. ติดตั้ง Git LFS แล้วดึงไฟล์จริง: `git lfs install` และ `git lfs pull`
   (ถ้าไม่ทำ PDF ของ demo จะเป็นแค่ pointer และ demo seed จะ error)
2. ใส่ค่าใน `backend/.env` (ค่าเหล่านี้ไม่ใช่ความลับ และไม่ต้องมี AWS key)

   ```
   COGNITO_REGION=ap-southeast-1
   COGNITO_USER_POOL_ID=ap-southeast-1_xMmT7e1aL
   COGNITO_APP_CLIENT_ID=617vl51nb7p31ciha9q86esd6c
   ```

   ถ้าใช้ Docker Compose ให้ใส่ใน `.env` ที่ root ของ repo แทน Compose ส่งต่อให้ backend เอง
3. บัญชีทดสอบ (ข้อมูลสมมติ) บทบาทละ 1 บัญชี: `public@`, `student@`, `coordinator@`,
   `staff@`, `admin@example.test` ขอรหัสผ่านจากผู้ดูแลทางแชทส่วนตัว
   **ห้ามใส่รหัสผ่านใน repo, issue, PR หรือแชทกลุ่ม**
4. ทดลอง API ที่ `http://localhost:8000/docs`: เรียก `POST /api/v1/auth/login`
   คัดลอก `access_token` กด **Authorize** แล้วเรียก endpoint อื่นได้
5. ฐานข้อมูลเดิมที่มีอยู่แล้ว: รัน `python migrate_v3.py` จากโฟลเดอร์ `backend`
   (รันซ้ำได้) ฐานข้อมูลใหม่ backend สร้างตารางให้เองตอนเริ่ม

## จัดการบัญชี

- บัญชีอยู่ใน Cognito ไม่ได้สร้างผ่านเว็บ ต้องการบัญชีเพิ่มหรือเปลี่ยนบทบาท แจ้งผู้ดูแล
- เปลี่ยนบทบาท = ย้าย group ใน Cognito มีผลกับ token ถัดไปของผู้ใช้ (ภายใน 60 นาที)
- ปิดบัญชีทันที: ตั้ง `users.is_active = false` ในฐานข้อมูล
- สร้าง pool และบัญชีทดสอบใหม่ทั้งชุด: `infra/provision_cognito.py --profile <profile> --apply`
  (ต้องใช้ AWS profile ที่มีสิทธิ์ Cognito เท่านั้น ห้ามใช้ root key)

## หมายเหตุ

- บทบาท `teacher` ใน frontend เปลี่ยนชื่อเป็น `coordinator` แล้ว ให้ตรงกับ backend
- เว็บ live ยังไม่ได้ deploy backend ของ V3 ปุ่ม login บนเว็บ live จึงยังใช้ไม่ได้
  จะ deploy พร้อมกันเมื่อ V3 เสร็จ (ต้องตั้ง `COGNITO_USER_POOL_ID` และ `COGNITO_APP_CLIENT_ID` บน EC2)
