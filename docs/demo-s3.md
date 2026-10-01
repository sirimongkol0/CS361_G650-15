# เอกสารเดโมบน S3

วันที่ 2 ตุลาคม 2026 ระบบเดโมที่ http://localhost:3100 ใช้ S3 จริงแล้ว
Metadata และความสัมพันธ์ยังอยู่ใน PostgreSQL `cstu_demo`
ไฟล์อยู่ใน bucket เดิม `cs361-partner-docs` region `ap-southeast-1`
ใต้ `cstu-demo/v2/<sha256>/<filename>` แยกจากไฟล์ข้อมูลจริง
Backend อ่านไฟล์หลังตรวจ publication; browser ดาวน์โหลดผ่าน `/api/v1/documents/{id}/download`
ไม่ส่ง credentials หรือ URL ของ S3 ไปให้ frontend

## เริ่มเครื่องนี้อีกครั้ง

```powershell
docker compose -f docker-compose.demo.yml -f docker-compose.demo-s3.yml up -d --wait
```

`.env.demo-s3` เป็นไฟล์ ignored ที่มีการตั้งค่าสำหรับ Backend เท่านั้น
ไม่แสดงค่า credentials ในเอกสารหรือผลทดสอบ ไม่รวมไฟล์นี้ใน source/Docker build
Seed ใช้ local storage แยกเพื่อให้การเตรียมข้อมูลไม่ต้องมี AWS
หากใช้ Compose หลักไฟล์เดียว Backend จะอ่านสำเนา local แทน S3

## ตั้งค่าเครื่องใหม่

1. เริ่ม Compose หลักตามคู่มือเดโม เพื่อเตรียม DB และไฟล์สมมติ
2. ตั้ง `S3_BUCKET`, `AWS_REGION` และ credentials ฝั่งเซิร์ฟเวอร์ใน `.env`
   ให้เข้าถึง prefix เดโมใน bucket ที่มีอยู่
3. รัน `python scripts/upload_demo_s3.py` ด้วย environment ที่มี boto3/dotenv
   สคริปต์อัปโหลดไฟล์ 6 รายการ ตรวจ SHA-256 จาก GetObject และหยุดเมื่อมีข้อผิดพลาด
4. คัดลอก `.env.demo-s3.example` เป็น `.env.demo-s3` และกำหนดค่า S3/credentials
   ใช้ EC2 instance role เมื่อ deploy บน EC2 ได้; สำหรับ Docker local ต้องส่ง credentials ให้ Backend
5. เปิด Compose ทั้งสองไฟล์ แล้วรัน browser test ตามคู่มือเดโม

Object keys มี hash ของเนื้อหา รัน upload ซ้ำด้วย PDF เดิมได้โดยไม่แตะ real-data keys
ไม่สร้าง bucket ไม่เปลี่ยน ACL/policy และไม่ลบไฟล์เดิม
IAM สำหรับไฟล์เดโมใช้ `s3:GetObject` และ `s3:PutObject`
บน `arn:aws:s3:::cs361-partner-docs/cstu-demo/v2/*`
ไม่ต้องให้ frontend ใช้ AWS credentials หรือเปิด bucket เป็นสาธารณะ
แนวทางควบคุมการเข้าถึงดู [AWS S3 access management](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-management.html)

## ผลตรวจ

- อัปโหลดและอ่านกลับ 6 PDF จาก S3 พร้อมตรวจ SHA-256 ตรงกับไฟล์ที่สร้าง
- ไฟล์ทั้ง 6 ปฏิเสธ anonymous HEAD ด้วย HTTP 403; ไม่มีการเปลี่ยน bucket policy
  สิทธิ์ปัจจุบันอ่าน/เขียน object ได้ แต่ HeadBucket/GetPublicAccessBlock ถูกปฏิเสธ
  จึงไม่อ้างว่าตรวจค่าตั้ง public-access-block ของ bucket ได้
- Backend runtime ยืนยัน `STORAGE_BACKEND=s3`
- ดาวน์โหลดผ่าน public API ครบ 5 PDF สาธารณะและตรวจ hash/size ตรงกับ manifest
  ฉบับร่างภายในไม่อยู่ใน list และ detail/download คืน 404
- Browser integration ผ่านกับ S3 จริง รวม filename ภาษาไทยและ PDF bytes
- รายละเอียด Stakeholder/กิจกรรมเพิ่มแล้ว; IDs และจำนวนยังคง 12/8/15
- รัน seed v2 ซ้ำไม่เปลี่ยนข้อมูล; Backend regression 84 passed, 4 skipped
- PDF 6 หน้า render และตรวจภาพแล้ว ไม่มีข้อความล้นหน้า

ไฟล์หลักฐาน: `.tmp-demo-enrichment/s3-upload.json`, `storage-verification.json`,
`.tmp-fictional-demo/result.json` และภาพในโฟลเดอร์เดียวกัน
สำรอง DB เดโมก่อน enrichment ไว้ที่ `.tmp-demo-enrichment/db-before.sql`
ไฟล์ต้นฉบับ PDF สำหรับนำเสนออยู่ใน `output/pdf/`
สำเนาที่บรรจุ Docker และ manifest อยู่ใน `backend/fixtures/demo-documents/`
