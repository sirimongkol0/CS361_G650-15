# Baseline และการเปรียบเทียบก่อน–หลังของ V5

> วันที่: 8 พฤศจิกายน 2026 · ใช้กับ #118 (V5-1) และ #125 (V5-8)
> เอกสารนี้เป็น baseline ของ V4 และผลที่วัดได้จาก V5 ใน Learner Lab
> ตัวเลขที่ยังไม่ได้จับจะถูกทำเครื่องหมาย **TBD** พร้อมวิธีวัด
> หลักฐานอยู่ใน [v5-validation.md](v5-validation.md) และ `docs/evidence/v5/`

## วิธีอ่านเอกสารนี้

- **V4 (ก่อน)** เป็นขั้นตอนที่อธิบายใน [สถาปัตยกรรม V4](../architecture/v4-architecture.md)
  และ `infra/new-account/deploy.sh` ฉบับ V4
- **V5 (หลัง)** เป็นผลจาก template/สคริปต์ใน branch `v5/automation`
  ที่รันใน Learner Lab วันที่ 8 พฤศจิกายน 2026
- ตัวเลขเวลาของ V4 เป็น **ค่าประมาณ** จากคำอธิบายสคริปต์และขนาดเครื่อง
  ยังไม่มีการจับเวลา end-to-end ใน Learner Lab
- ตัวเลขเวลาของ V5 ที่ยังไม่ได้จับใช้ **TBD** พร้อมหมายเหตุ; ห้ามเดาแล้วใส่เป็นผล
- ผลทดสอบและหลักฐานอยู่ใน [v5-validation.md](v5-validation.md) และโฟลเดอร์ `docs/evidence/v5/`

## Baseline V4: ขั้นตอน deploy ครั้งแรก

V4 deploy จาก CloudShell (region Sydney) ตามลำดับนี้
นับเฉพาะขั้นที่ต้องมีคนสั่งหรือกรอกค่า:

| # | ขั้น | คำสั่ง/การกระทำ | จำนวนครั้ง | เวลาประมาณ | ที่มา/หมายเหตุ |
|---|---|---|---|---|---|
| 1 | ตรวจบัญชี | `./deploy.sh check` | 1 command | ~1 นาที | probe หลายบริการ |
| 2 | สร้าง infrastructure | `./deploy.sh infra --apply` | 1 command | ~3 นาที | comment ในสคริปต์ V4 ระบุ “about 3 minutes” |
| 3 | สร้าง Cognito | `./deploy.sh cognito --apply` | 1 command | ~1–2 นาที | สร้าง pool/group/test users ผ่าน boto3 |
| 4 | Deploy backend | `./deploy.sh backend` | 1 command | ~5–7 นาที | upload + docker build บน t3.micro |
| 5 | Seed | `./deploy.sh seed --yes` | 1 command | ~1 นาที | ลบและใส่ข้อมูล `cstu_demo` |
| 6 | สร้าง Amplify | `./deploy.sh amplify` (แสดงค่า) + Console: Create app → GitHub → repo/branch → monorepo root → 3 env vars → Save and deploy | 1 command + 8 interactions | ~8–10 นาที | รวมเวลารอ build ครั้งแรก |
| 7 | ตั้ง CORS รอบสอง | `CORS_ORIGINS=<Amplify URL> ./deploy.sh backend` | 1 command | ~5–7 นาที | ต้อง deploy backend ซ้ำเพราะยังไม่รู้ URL ก่อนหน้า |
| 8 | สำรองข้อมูล | `./deploy.sh backup` | 1 command | ~1 นาที | ยังเป็น manual |
| **รวม** | | | **8 commands + 8 Console interactions = 16 manual actions** | **~25–32 นาที** | ครั้งแรกที่มีปัญหา/รอ build อาจเป็น 30–45 นาที |

### นับเฉพาะรอบอัปเดต backend

หลัง deploy ครั้งแรก การอัปเดต backend ใน V4 ต้องทำ:

1. `./deploy.sh backup`
2. `./deploy.sh backend`
3. รอ health check

รวม **2 commands** ต่อรอบ (ยังไม่นับการ merge/push โค้ด)

> หมายเหตุ: ตัวเลข 8 Console interactions นับทีละช่อง/การคลิกที่ต้องมีคนทำ
> ได้แก่ Create new app (1), connect GitHub (1), เลือก repo/branch (1),
> monorepo root (1), environment variables 3 ช่อง (3), Save and deploy (1)
> ไม่นับการเปิด CloudShell หรือการอัปโหลดไฟล์เข้า CloudShell

## V5: ขั้นตอนที่รันจริง

V5 ใช้ลำดับจาก [สถาปัตยกรรม V5](../architecture/v5-architecture.md):

1. `./deploy.sh check`
2. `./deploy.sh infra --apply`
3. `./deploy.sh cognito --apply`
4. `./deploy.sh amplify --apply` (มี token) หรือ `./deploy.sh frontend --apply` (fallback)
5. `./deploy.sh backend`
6. `./deploy.sh seed --yes`
7. `./deploy.sh schedule --apply`
8. `./deploy.sh status` (ตรวจผล; ไม่นับเป็นขั้นสร้าง)
9. `./deploy.sh backup` และ `./deploy.sh restore <key> --yes` (ตรวจ backup/restore)

รวม **7 commands** สำหรับการสร้างครั้งแรก + 1 คำสั่งตรวจสถานะ (ถ้านับ)
และ **0 AWS Console interactions** ที่บังคับ
ถ้าใช้ Amplify ยังต้องสร้าง GitHub PAT หนึ่งครั้งใน GitHub UI
(ไม่ใช่ AWS Console) และถ้าใช้ fallback ไม่ต้องใช้ token เลย

สำหรับการ recreate จากศูนย์ ให้ใช้ `./deploy.sh teardown --yes --purge`
หลัง backup; `--purge` จะลบ S3 bucket และ Cognito pool ที่ปกติถูก Retain

รอบอัปเดต backend ของ V5:

1. `./deploy.sh backend`
2. รอ health check (สคริปต์ตรวจให้)

รวม **1 command** เพราะ backup ถูก schedule ไว้แล้ว
(ถ้าต้องการ backup ก่อน deploy ด้วยมือ สามารถรัน `./deploy.sh backup` เพิ่มได้)

## ตารางก่อน–หลัง

| ตัวชี้วัด | V4 (ก่อน) | V5 (หลัง, ผล Lab 8 พ.ย. 2026) |
|---|---|---|
| **Manual steps** | 8 commands + 8 Console interactions = **16 manual actions** ในการ deploy ครั้งแรก; รอบอัปเดต backend = 2 commands | **7 commands + 0 AWS Console interactions** ในการ deploy ครั้งแรก (ยืนยันจาก `v5-8-full-run.txt`); รอบอัปเดต backend = 1 command ตามการออกแบบ แต่ยังไม่ได้ทดสอบรอบอัปเดตจริง; ถ้าใช้ Amplify มี GitHub PAT 1 ครั้ง (อยู่นอก AWS) |
| **System create time** | ประมาณ **13–15 นาที** (infra ~3 + Cognito ~1–2 + Amplify ~8–10) | **3m38s** — infra 72s + Cognito 57s + frontend fallback 89s (cs361-v5r, 16:17:34–16:23:10Z); ไม่รวม backend/seed/schedule |
| **Full first deploy (end-to-end)** | **~25–32 นาที** (8 commands + 8 Console interactions; backend รัน 2 ครั้งเพื่อ CORS) | **7m59s** — cs361-v5r ตั้งแต่ `check` ถึง `status` (16:17:15–16:25:14Z); ไม่มี Console interaction และไม่มี backend รอบสอง |
| **Backend deploy time** | ประมาณ **5–7 นาทีต่อครั้ง**; deploy ครั้งแรก **2 ครั้ง** (backend + CORS) = 10–14 นาที | **64s** — cs361-v5r backend step (16:20:27–16:21:31Z); CORS มาจาก SSM/output จึงไม่ต้อง deploy ซ้ำ (ยืนยันจาก `v5-3-cors.txt`) |
| **Failures prevented** | **0** ที่ป้องกันอัตโนมัติ; CORS mismatch, backup ลืม, secret ผิด ต้องเจอเอง | **6 กลไกที่มีหลักฐานใน Lab**: ① CORS อัตโนมัติ ② secret/password handling ③ config จาก SSM ④ backup + alarm ⑤ drift detection ⑥ Lab mode ไม่สร้าง IAM (รายละเอียดใน `v5-validation.md`) |

### สมมติฐานและผล

> **H1 (ยืนยัน):** V5 ใช้ 7 commands + 0 AWS Console interactions ใน fallback
> (Amplify มี GitHub PAT 1 ครั้งนอก AWS)
> **H2 (ยืนยัน):** CORS มาจาก SSM/output; ไม่ต้อง deploy backend ซ้ำ
> **H3 (บางส่วน):** รอบนี้ deploy backend 1 ครั้งและ backup ทำงานตาม schedule;
> ยังไม่ได้ทดสอบรอบอัปเดต backend ปกติใน stack เดียวกัน
> **H4 (ยืนยันบางส่วน):** มี 6 กลไกที่มีหลักฐาน; การจำลอง secret ผิดยังไม่ได้ทำ
>
> ตัวเลขที่วัดได้แล้ว: full first deploy **7m59s**, backend **64s**, backup **23s**,
> restore **23s**, teardown **171s** (cs361-v5r, 8 พ.ย. 2026)
> ที่ยังรอ: รอบอัปเดต backend ปกติ และการ recreate รอบที่สอง (กำลังเก็บหลักฐาน)

## ผลจริงจาก Lab (8 พฤศจิกายน 2026)

| รายการ | ผลที่บันทึก | หลักฐาน |
|---|---|---|
| Stack `cs361` | CREATE_COMPLETE | `v5-8-full-run.txt`, `v5-4-config.txt` |
| Stack `cs361-cognito` | CREATE_COMPLETE; pool `us-west-2_91XZumUyS`, client `19k8vib1vf3d586cqvppbp4ntu`; 5 groups | `v5-2-cognito.txt` |
| Stack `cs361-backup` | CREATE_COMPLETE; schedule `cs361-backup` ENABLED; first run Success 15:43:22Z | `v5-6-backup-stack.txt`, `v5-6-backup-run.txt` |
| Amplify stack/build | N/A — ไม่มี GitHub token; API probe สร้าง app/branch ได้แล้วลบ | `v5-3-amplify.txt`, `v5-3-build.txt` |
| Fallback frontend | ผ่าน; `http://32.189.5.234:3000/dashboard/public` 200 (30,435 bytes) | `v5-3-fallback.txt` |
| Backend/API | health 200; login ผ่าน fallback proxy 200 role=admin | `v5-4-config.txt`, `v5-3-fallback.txt` |
| CORS | origin `http://32.189.5.234:3000` ผ่าน; origin อื่น 400 | `v5-3-cors.txt` |
| Backup manual | สำเร็จ 15:43:43Z; metric `BackupSuccess=2.0` ในช่วง 15:40Z | `v5-6-backup-run.txt` |
| Restore | สำเร็จ; documents 25, feedbacks 45, outcomes 0; partners 29 | `v5-6-restore.txt` |
| Failure alert | metric 0, SNS publish 1, alarm `cs361-backup-failed` = ALARM | `v5-6-alert.txt` |
| Drift | `AppSecurityGroup` = MODIFIED หลังเพิ่ม ingress 9999; revoke แล้ว; IN_SYNC ยัง TBD | `v5-7-drift.txt` |
| CI lint/guard | ผ่านในเครื่อง; GitHub Actions ยังไม่รัน (ไม่ push) | `v5-7-ci.txt` |
| Teardown + recreate | ยัง TBD; ต้องใช้ `teardown --yes --purge` เพื่อลบ S3/Cognito | `v5-8-full-run.txt` |

### Timestamp ที่บันทึกได้

| เวลา (UTC) | เหตุการณ์ |
|---|---|
| 15:33:10 | Cognito test users created |
| 15:33:25 | backend tarball uploaded |
| 15:36:17 | frontend tarball uploaded |
| 15:39:28 | backup stack creation started |
| 15:43:22 | EventBridge Scheduler first backup Success |
| 15:43:43 | manual backup |
| 15:45:27 | simulated backup failure |
| 15:46:04 | recovery backup succeeded |

> ช่วง 15:33:10–15:39:28 ครอบ Cognito ถึง backup stack แต่ไม่ได้เริ่มจับที่ `check`/`infra`
> จึงใช้เป็นค่าประมาณ ~10 นาทีได้ แต่ยังไม่ใช่ system create time ที่สมบูรณ์

## วิธีวัดตัวเลข TBD

### หลักการ

- ใช้ Lab session เดียวที่สะอาด (ไม่มี stack `cs361*` ค้าง) และจด region/account
- จดเวลาด้วย UTC: `date -u +%FT%TZ` ก่อนและหลังแต่ละขั้น
- ใช้ `time` ครอบคำสั่ง `deploy.sh` เพื่อแยกเวลา command กับเวลา CloudFormation
- เก็บ output ที่ไม่มีความลับไว้ใน `docs/evidence/v5/` แล้วสรุปผลใน `v5-validation.md`

### คำสั่งวัดเวลา

```bash
export AWS_REGION=us-west-2
export LAB_MODE=true
cd infra/new-account

# เวลารวมของการสร้างครั้งแรก
start=$(date +%s)
./deploy.sh check
./deploy.sh infra --apply
./deploy.sh cognito --apply
./deploy.sh frontend --apply       # หรือ amplify --apply เมื่อมี token
./deploy.sh backend
./deploy.sh seed --yes
./deploy.sh schedule --apply
./deploy.sh status
end=$(date +%s)
echo "first deploy seconds: $((end-start))"

# สำหรับ recreate จากศูนย์ (หลัง backup) — ลบ S3/Cognito ที่ปกติ retain
./deploy.sh backup
./deploy.sh teardown --yes --purge
```

```bash
# เวลาสร้าง stack ของ CloudFormation
aws cloudformation describe-stacks --stack-name cs361 \
  --query 'Stacks[0].CreationTime' --output text
aws cloudformation describe-stacks --stack-name cs361-cognito \
  --query 'Stacks[0].CreationTime' --output text
aws cloudformation describe-stacks --stack-name cs361-amplify \
  --query 'Stacks[0].CreationTime' --output text 2>/dev/null || true
aws cloudformation describe-stacks --stack-name cs361-backup \
  --query 'Stacks[0].CreationTime' --output text
```

```bash
# เวลา deploy backend จาก SSM command ล่าสุด
INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name cs361 \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text)
aws ssm list-commands --instance-id "$INSTANCE_ID" \
  --query 'Commands[?Comment!=`null`].[Comment,RequestedDateTime,CompletedDateTime,Status]' \
  --output table
```

```bash
# เวลา Amplify build (ถ้าใช้)
APP_ID=$(aws cloudformation describe-stacks --stack-name cs361-amplify \
  --query "Stacks[0].Outputs[?OutputKey=='AppId'].OutputValue" --output text 2>/dev/null || true)
aws amplify list-jobs --app-id "$APP_ID" --branch-name main \
  --query 'jobSummaries[].[jobId,status,startTime,endTime]' --output table
```

### วิธีนับ manual steps

- เปิด screen recording หรือจดทีละ action ระหว่าง deploy
- นับ **1 action** ต่อหนึ่งคำสั่งที่พิมพ์ หรือหนึ่งการคลิก/หนึ่งช่องที่กรอก
- ไม่นับการรอ build, การอ่าน log หรือการเปิดหน้า Console เฉย ๆ
- แยก **AWS Console**, **GitHub UI** และ **CLI** เพื่อไม่ให้ปนกัน
- บันทึกจำนวน command จาก shell history เฉพาะที่มี `deploy.sh`

### วิธีวัด failures prevented

ทดลองใน stack ชั่วคราวที่ลบได้ (ห้ามทำกับข้อมูลจริง) แล้วนับว่ากลไกใดจับได้:

| # | สถานการณ์ที่จำลอง | กลไกที่ควรจับ | ผ่านเมื่อ |
|---|---|---|---|
| 1 | ตั้ง `CORS_ORIGINS` ไม่ตรงกับ frontend | `deploy.sh backend` อ่าน `amplify_url`/`FrontendUrl` ให้ | ไม่ต้อง deploy backend ซ้ำ |
| 2 | เปลี่ยน secret ให้ผิด | health check/DB connection ล้มเหลวและรายงาน | มี error ชัดเจน ไม่เงียบ |
| 3 | ลบ SSM parameter ที่ backend ใช้ | `deploy.sh backend` อ่านไม่ครบและหยุด | ไม่เขียน `.env` ครึ่งชุด |
| 4 | ไม่ได้รัน backup | Scheduler/CloudWatch alarm | มี backup object หรือ alarm |
| 5 | แก้ tag/security group จาก Console | drift detection | `describe-stack-resource-drifts` รายงาน |
| 6 | ตั้ง `LAB_MODE=false` ใน Lab | `check`/stack ล้มเหลวเพราะสร้าง IAM ไม่ได้ | ข้อความบอกให้ใช้ `LAB_MODE=true` |

ผล Lab 8 พ.ย.: กลไก CORS, backup/alarm, drift, Lab mode และ config จาก SSM
มีหลักฐานตรง; secret/password มีหลักฐานว่าอ่านและใช้งานได้ แต่ยังไม่ได้จำลอง secret ผิด
ส่วน template lint มีหลักฐานใน `v5-7-ci.txt` (local)

## สิ่งที่ยัง manual ใน V5

- สร้าง GitHub PAT และ secret `GITHUB_TOKEN_SECRET_ARN` ถ้าจะใช้ Amplify
- ยืนยันอีเมล SNS subscription ครั้งแรก
- `seed --yes` และ `restore --yes` เป็นคำสั่งที่ต้องยืนยันเพราะทำลายข้อมูล
- การหมุนรหัสผ่านฐานข้อมูล (update secret แล้วรัน `deploy.sh backend`)
- การติดตั้ง/เปิด self-hosted runner (ถ้าใช้ automation)
- การตรวจ drift ตามรอบ (CI หรือคำสั่ง manual)
- การตัดสินใจใช้ fallback เมื่อ Amplify build ไม่ผ่าน
- `teardown --yes --purge` เมื่อต้อง recreate จากศูนย์
- การจับเวลา exact ของ `check`/`infra`/`backend` ใน session ใหม่

## เอกสารที่เกี่ยวข้อง

- [สถาปัตยกรรม V4](../architecture/v4-architecture.md)
- [สถาปัตยกรรม V5](../architecture/v5-architecture.md)
- [แผนทดสอบ V5](v5-validation.md)
- [คู่มือ deploy V5](../runbooks/v5-deploy.md)
- [ขอบเขต Learner Lab V5](../decisions/v5-learner-lab-scope.md)
