# หลักฐานการรัน V5 ใน Learner Lab

> วันที่: 8 พฤศจิกายน 2026 · บัญชี `073362813452` · role `voclabs` · region `us-west-2`
> ทุกไฟล์ในโฟลเดอร์นี้เป็นข้อความ/ผลคำสั่งที่คัดลอกมาโดย **ไม่มีรหัสผ่านหรือ token**
> ผลสรุปอยู่ใน [v5-validation.md](../v5-validation.md)

| ไฟล์ | ใช้เป็นหลักฐานของ |
|---|---|
| `v5-lab-constraints.txt` | ข้อจำกัด Learner Lab ที่ตรวจซ้ำได้ |
| `v5-2-cognito.txt` | #119 Cognito เป็น IaC |
| `v5-3-amplify.txt` | #120 Amplify (N/A: ไม่มี token) |
| `v5-3-fallback.txt` | #120 fallback frontend + CORS |
| `v5-3-build.txt` | #120 Amplify build (N/A) |
| `v5-3-cors.txt` | #120 CORS preflight |
| `v5-4-config.txt` | #121 SSM/Secrets |
| `v5-5-oidc.txt` | #122 ปิดเป็น not planned |
| `v5-auth-fallback.txt` | Cognito default + local auth fallback |
| `v5-tls.txt` | HTTPS ด้วย Caddy + sslip.io |
| `v5-6-backup-stack.txt` | #123 backup stack/schedule/alarm |
| `v5-6-backup-run.txt` | #123 backup ที่รันจริง |
| `v5-6-restore.txt` | #123 restore ที่รันจริง |
| `v5-6-alert.txt` | #123 จำลอง backup ล้มเหลว |
| `v5-7-ci.txt` | #124 cfn-lint/cfn-guard |
| `v5-7-drift.txt` | #124 drift detection |
| `v5-8-full-run.txt` | #125 ลำดับและเวลาที่รันจริง (stack cs361) |
| `v5-8-recreate.txt` | #125 clean recreate stack cs361-v5r + teardown/purge |

## ข้อควรระวัง

- ไฟล์เหล่านี้ไม่ใช่ production evidence; เป็น Lab account ที่มีเครดิตจำกัด
- Credentials ของ Lab หมดอายุเมื่อจบ session; ผลบางข้อต้องรันซ้ำใน session ใหม่
- ห้ามเพิ่มรหัสผ่าน, token, secret JSON หรือ `.env` ลงในโฟลเดอร์นี้
