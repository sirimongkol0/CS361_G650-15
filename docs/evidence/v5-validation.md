# แผนทดสอบและหลักฐาน V5

> วันที่: 8 พฤศจิกายน 2026 · ใช้กับ #125 (V5-8) และตรวจงาน #119–#124
> **ผลทดสอบหลักรันใน Learner Lab เมื่อ 8 พ.ย. 2026** — หลักฐานอยู่ใน `docs/evidence/v5/`
> ช่องที่ยังไม่ได้รัน (GitHub Actions เพราะไม่ push) จะระบุว่า TBD
> เอกสารนี้บอกคำสั่ง ผลที่คาดหวัง และลิงก์หลักฐานของแต่ละข้อ

## วิธีบันทึกผล

1. ใช้ Lab session ที่สะอาดและจดบัญชี `073362813452`, role `voclabs`, region `us-west-2`
2. เริ่มด้วย `export AWS_REGION=us-west-2 LAB_MODE=true` และรัน `./deploy.sh check`
3. เก็บ command ที่รัน, timestamp (UTC), stack status และ output ที่ไม่มีความลับ
4. เก็บไฟล์ใน `docs/evidence/v5/` เช่น `v5-2-cognito.txt`, `v5-6-backup.txt`
   (ถ้ายังไม่สร้างโฟลเดอร์ ให้วาง log ต่อท้ายหัวข้อในไฟล์นี้ก่อน)
5. สรุปผลในตารางด้านล่างโดยเปลี่ยน `TBD` เป็น `PASS`/`FAIL` พร้อมลิงก์หลักฐาน
6. **ห้ามเก็บรหัสผ่าน, token, secret JSON หรือ `.env` ลงใน repository**

```bash
export AWS_REGION=us-west-2
export LAB_MODE=true
export STACK=cs361
cd infra/new-account
./deploy.sh check
```

## ตารางทดสอบหลัก

| ID | สิ่งที่ทดสอบ | คำสั่ง/วิธีการ | ผลที่คาดหวัง | หลักฐาน | ผล |
|---|---|---|---|---|---|
| **V5-2** | Cognito เป็น IaC | `./deploy.sh cognito --apply` แล้วตรวจ stack/pool/group/SSM | stack `cs361-cognito` CREATE_COMPLETE; pool `cstu-v5-auth`; client `cstu-backend`; กลุ่ม 5 กลุ่ม; SSM 2 ตัว; output ครบ | `docs/evidence/v5/v5-2-cognito.txt` | PASS |
| **V5-3a** | Amplify app/branch จาก stack | สร้าง secret token, `GITHUB_TOKEN_SECRET_ARN=... ./deploy.sh amplify --apply` | stack `cs361-amplify` CREATE_COMPLETE; app `WEB_COMPUTE`; branch `main`; SSM `amplify_url`; output `AppId`/`BranchUrl` | `docs/evidence/v5/v5-3-amplify.txt` | N/A — no token; template lint PASS; API probe PASS |
| **V5-3b** | Amplify build Next.js SSR | `aws amplify start-job` แล้ว `get-job`/`list-jobs` | สร้าง job ได้; **สถานะ build ยังไม่ยืนยัน**; ถ้า FAIL ต้องบันทึก error และใช้ fallback | `docs/evidence/v5/v5-3-build.txt` | N/A — not tested |
| **V5-3c** | Fallback frontend | `./deploy.sh frontend --apply`; เปิด `FrontendUrl/dashboard/public` | container `cs361-frontend` รันบน :3000; หน้าเว็บ 200; proxy `/api/v1` ไป backend ได้ | `docs/evidence/v5/v5-3-fallback.txt` | PASS |
| **V5-3d** | CORS | หลัง backend: `curl -i -X OPTIONS` จาก origin ของ Amplify/fallback; ตรวจ `CORS_ORIGINS` | `Access-Control-Allow-Origin` ตรงกับ origin ที่ใช้; ไม่ต้อง deploy backend ซ้ำ | `docs/evidence/v5/v5-3-cors.txt` | PASS |
| **V5-4** | SSM/Secrets | `aws ssm describe-parameters`; `secretsmanager get-secret-value` แล้วแสดงเฉพาะ key; `./deploy.sh backend` | parameter ครบ; secret มี key `username`, `dbname`, `password`; backend health ผ่าน; ไม่มี secret ใน log/git | `docs/evidence/v5/v5-4-config.txt` | PASS |
| **V5-5** | GitHub OIDC (ปิดแล้ว) | `aws iam list-open-id-connect-providers` | ไม่มี provider ที่ V5 สร้าง; ไม่มี IAM role สำหรับ GitHub; ตรงกับ #122 not planned | `docs/evidence/v5/v5-5-oidc.txt` | N/A (closed) |
| **V5-6a** | Backup stack | `ALERT_EMAIL=... ./deploy.sh schedule --apply`; `aws scheduler get-schedule --name cs361-backup` | stack `cs361-backup` CREATE_COMPLETE; schedule ENABLED; document `cs361-backup`; topic `cs361-backup-alerts`; alarm `cs361-backup-failed` | `docs/evidence/v5/v5-6-backup-stack.txt` | PASS |
| **V5-6b** | Backup manual/automated | `./deploy.sh backup`; ตรวจ `s3://<bucket>/backups/`; `cloudwatch get-metric-statistics` | ไฟล์ `.sql.gz` ใหม่; metric `BackupSuccess=1`; ไม่มี alarm ถ้าสำเร็จ | `docs/evidence/v5/v5-6-backup-run.txt` | PASS |
| **V5-6c** | Restore | `./deploy.sh backup`; `./deploy.sh restore <key> --yes` บน stack ทดสอบ | restore สำเร็จ; row counts กลับมา; backend กลับมา healthy | `docs/evidence/v5/v5-6-restore.txt` | PASS |
| **V5-6d** | Alert failure | ทำให้ backup ล้มเหลวใน stack ทดสอบ หรือ publish metric 0; ตรวจ SNS | alarm เปลี่ยนเป็น ALARM; อีเมลถูกส่ง (ถ้าสมัคร); กลับมา OK เมื่อ backup สำเร็จ | `docs/evidence/v5/v5-6-alert.txt` | PASS — metric 0 + SNS publish + alarm ALARM; email not configured |
| **V5-7a** | CI template lint | เปิด Actions run ของ `.github/workflows/infra.yml` หรือรัน `cfn-lint`/`cfn-guard` ตาม workflow | cfn-lint ผ่านทุก template; cfn-guard ผ่านกฎ; job สีเขียว | `docs/evidence/v5/v5-7-ci.txt` + URL ของ run | PASS (local); GitHub Actions TBD |
| **V5-7b** | Drift detection | เพิ่ม ingress ชั่วคราวพอร์ต 9999 (CIDR TEST-NET) → `detect-stack-drift` → `describe-stack-resource-drifts` → revoke | drift รายงาน `MODIFIED`; หลังแก้กลับเป็น `IN_SYNC` | `docs/evidence/v5/v5-7-drift.txt` | PASS — MODIFIED detected; IN_SYNC after revoke |
| **V5-8** | เอกสาร/หลักฐานครบ | ทำตาม [runbook](../runbooks/v5-deploy.md) ตั้งแต่ stack ว่าง; เติมตัวเลขใน [baseline](v5-baseline.md) | deploy ครบ; before/after มีตัวเลขจริง; ลิงก์เอกสารไม่แตก | `docs/evidence/v5/v5-8-full-run.txt`, `v5-8-recreate.txt` | PASS — cs361-v5r 7m59s / 6m35s; teardown --purge OK; เหลือ cs361 ตัวเดียว |

## ผลที่วัดได้จาก Lab

| รายการ | ค่าที่บันทึก | หลักฐาน |
|---|---|---|
| Cognito pool / client | `us-west-2_91XZumUyS` / `19k8vib1vf3d586cqvppbp4ntu` | `v5-2-cognito.txt` |
| API / fallback frontend | `http://32.189.5.234:8000` / `http://32.189.5.234:3000` | `v5-3-fallback.txt` |
| fallback page | 200, 30,435 bytes, title `CSTU / PCSMS` | `v5-3-fallback.txt` |
| CORS | origin ที่อนุญาต 200; origin อื่น 400 | `v5-3-cors.txt` |
| Backup object | `backups/cstu_demo-20261108T154324Z.sql.gz` (25,847 bytes) | `v5-6-backup-run.txt` |
| Backup metric | `BackupSuccess` Sum=2.0 ช่วง 15:40Z (scheduled + manual) | `v5-6-backup-run.txt` |
| Restore row counts | documents 25, feedbacks 45, outcomes 0; partners 29 | `v5-6-restore.txt` |
| Failure alert | `BackupSuccess=0`, SNS publish 1, alarm ALARM | `v5-6-alert.txt` |
| Drift | `AppSecurityGroup` MODIFIED (ingress 9999) | `v5-7-drift.txt` |

> เวลารวมของ first deploy ไม่ได้จับจากจุดเริ่ม `check`; ดูรายละเอียดและค่าประมาณ
> ใน [baseline](v5-baseline.md) — exact timing ยัง TBD
>
> Teardown + recreate ทดสอบแล้วด้วย `cs361-v5r`: run 1 = 7m59s, run 2 = 6m35s,
> teardown `--purge` = 179s; หลัง cleanup เหลือเฉพาะ stack `cs361` เดิม
> (ดู `v5-8-recreate.txt`)
>
> Auth: `cs361` ใช้ Cognito (login 200 role=admin); local auth fallback มี tests
> ผ่าน 7 tests และ wiring `AUTH_BACKEND=local` พร้อมใช้ แต่ยังไม่เปิดใน run นี้
> (ดู `v5/v5-auth-fallback.txt`)
>
> HTTPS: `https://32.189.5.234.sslip.io/dashboard/public` ผ่าน Caddy +
> Let's Encrypt; page/API 200 (ดู `v5/v5-tls.txt`)

## รายละเอียดคำสั่ง

### V5-2 Cognito

```bash
./deploy.sh cognito            # plan/change set
./deploy.sh cognito --apply

aws cloudformation describe-stacks --stack-name cs361-cognito \
  --query 'Stacks[0].[StackStatus,Outputs]' --output json

POOL_ID=$(aws cloudformation describe-stacks --stack-name cs361-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

aws cognito-idp list-groups --user-pool-id "$POOL_ID" \
  --query 'Groups[].GroupName' --output table
aws ssm get-parameter --name /cs361/config/cognito_user_pool_id
aws ssm get-parameter --name /cs361/config/cognito_app_client_id
```

ทดสอบผู้ใช้: `provision_cognito.py` ถูกเรียกโดย `cognito --apply`
และเก็บรหัสผ่านแยกตาม pool ใน `~/.config/cstu/cognito-test-users-<pool-id>.txt`
ทดสอบเข้าสู่ระบบผ่านหน้าเว็บหรือ `/api/v1/auth/login` โดยไม่พิมพ์รหัสผ่านลง terminal
ผลที่ต้องได้: token มี `cognito:groups` ตรงกับบทบาท

> หลักฐาน `v5-2-cognito.txt` ถูกเก็บก่อนเปลี่ยนมาใช้ชื่อไฟล์แยกตาม pool
> การรันครั้งถัดไปต้องใช้ไฟล์ `cognito-test-users-<pool-id>.txt`

### V5-3 Amplify และ fallback

**เส้นทางมี token:**

```bash
aws secretsmanager create-secret --name cs361/github-token \
  --secret-string '{"token":"github_pat_..."}' --region "$AWS_REGION"

export GITHUB_TOKEN_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id cs361/github-token --query ARN --output text)

./deploy.sh amplify
./deploy.sh amplify --apply

aws cloudformation describe-stacks --stack-name cs361-amplify \
  --query 'Stacks[0].[StackStatus,Outputs]' --output json
aws ssm get-parameter --name /cs361/config/amplify_url
```

**เส้นทาง fallback (ไม่มี token หรือ Amplify build ไม่ผ่าน):**

```bash
./deploy.sh frontend --apply

FRONT=$(aws cloudformation describe-stacks --stack-name cs361 \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" --output text)
curl -fsS "$FRONT/dashboard/public" >/dev/null && echo "fallback OK: $FRONT"
```

> `./deploy.sh frontend` โดยไม่มี `--apply` เป็นเพียง plan (ไม่ build/start container)

CORS: ถ้าเบราว์เซอร์เรียก API ตรง ให้ตั้ง `CORS_ORIGINS` แล้วรัน `./deploy.sh backend`
ถ้าใช้ proxy same-origin ไม่ต้องเพิ่ม origin
ตรวจ preflight:

```bash
curl -i -X OPTIONS "$API/api/v1/health" \
  -H "Origin: $FRONT" \
  -H "Access-Control-Request-Method: GET"
```

### V5-4 SSM/Secrets

```bash
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Values=/cs361/config" \
  --query 'Parameters[].Name' --output table

SECRET_ARN=$(aws ssm get-parameter --name /cs361/config/db_secret_arn \
  --query Parameter.Value --output text)
aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" \
  --query SecretString --output text \
  | python3 -c 'import json,sys; print(sorted(json.load(sys.stdin).keys()))'
```

ต้องได้ `['dbname', 'password', 'username']` และ **ไม่พิมพ์ค่ารหัสผ่าน**
จากนั้น `./deploy.sh backend` และ `./deploy.sh status`
ตรวจว่าไม่มี secret ใน Git:

```bash
git grep -nE 'github_pat_|POSTGRES_PASSWORD=.{8,}' -- . ':!docs' || true
```

### V5-6 Backup และ restore

```bash
ALERT_EMAIL=you@example.com ./deploy.sh schedule
ALERT_EMAIL=you@example.com ./deploy.sh schedule --apply

aws scheduler get-schedule --name cs361-backup \
  --query '[State,ScheduleExpression,Target.Arn]' --output table
aws ssm describe-document --name cs361-backup --query 'Document.Status'
aws sns list-topics --query 'Topics[?contains(TopicArn,`cs361-backup-alerts`)]'
aws cloudwatch describe-alarms --alarm-names cs361-backup-failed \
  --query 'MetricAlarms[0].[StateValue,TreatMissingData]' --output table

./deploy.sh backup
BUCKET=$(aws cloudformation describe-stacks --stack-name cs361 \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
aws s3 ls "s3://$BUCKET/backups/" | tail
```

ทดสอบ schedule โดยไม่รอหนึ่งวัน (ทำใน stack ทดสอบเท่านั้น):

```bash
# เปลี่ยนเป็น rate(5 minutes) ชั่วคราว แล้วรอ object ใหม่
BACKUP_SCHEDULE='rate(5 minutes)' ./deploy.sh schedule --apply
# เมื่อทดสอบเสร็จ กลับเป็น rate(1 day)
BACKUP_SCHEDULE='rate(1 day)' ./deploy.sh schedule --apply
```

Restore (ทำลายข้อมูล — ใช้ stack ทดสอบ):

```bash
./deploy.sh backup
KEY=$(aws s3 ls "s3://$BUCKET/backups/" | tail -1 | awk '{print $4}')
./deploy.sh restore "backups/$KEY" --yes
```

### V5-7 CI และ drift

```bash
# ใน CI หรือเครื่องที่ติดตั้ง tools
shopt -s globstar
cfn-lint infra/**/*.yaml
bash scripts/install_cfn_guard.sh
cfn-guard validate --data infra --rules .cfn-guard/rules.guard --type CFNTemplate
```

Drift test:

```bash
SG=$(aws cloudformation describe-stacks --stack-name cs361 \
  --query "Stacks[0].Outputs[?OutputKey=='SecurityGroupId'].OutputValue" --output text)

aws ec2 authorize-security-group-ingress --group-id "$SG" \
  --protocol tcp --port 9999 --cidr 203.0.113.0/24

aws cloudformation detect-stack-drift --stack-name cs361
aws cloudformation describe-stack-resource-drifts --stack-name cs361 \
  --stack-resource-drift-status-filters MODIFIED DELETED \
  --query 'StackResourceDrifts[].{Type:ResourceType,Status:StackResourceDriftStatus,Property:LogicalResourceId}' \
  --output table

aws ec2 revoke-security-group-ingress --group-id "$SG" \
  --protocol tcp --port 9999 --cidr 203.0.113.0/24
```

หลัง revoke ให้รอสักครู่แล้ว `detect-stack-drift` อีกครั้ง; คาดว่า `IN_SYNC`
ถ้าไม่กลับ ให้ `./deploy.sh infra --apply` เพื่อ reconcile

## การตรวจเฉพาะ Learner Lab

| ตรวจ | คำสั่ง | ผลที่คาดหวัง | ผล |
|---|---|---|---|
| Region ที่อนุญาต | `aws ec2 describe-vpcs --region us-west-2 --max-items 1` | ผ่าน | PASS |
| Region ที่ไม่อนุญาต | `aws ec2 describe-vpcs --region ap-southeast-2 --max-items 1` | ถูกปฏิเสธ (AccessDenied/AuthFailure) | PASS (AccessDenied) |
| IAM role ที่มีอยู่ | `aws iam get-role --role-name LabRole`; `aws iam get-instance-profile --instance-profile-name LabInstanceProfile` | เห็นทั้งสอง resource | PASS |
| IAM create ถูกปฏิเสธ | `aws iam create-role ...` ด้วย trust policy ทดสอบ | AccessDenied; **ไม่สร้างจริง** | PASS (AccessDenied) |
| OIDC ถูกปฏิเสธ | `aws iam create-open-id-connect-provider ...` | AccessDenied; V5 ไม่พึ่ง OIDC | PASS (AccessDenied) |
| Cognito | `aws cognito-idp list-user-pools --max-results 60` | เห็น `cstu-v5-auth` | PASS |
| SSM/Secrets | ตาม V5-4 | parameter/secret ครบ | PASS |
| Scheduler | `aws scheduler get-schedule --name cs361-backup` | ENABLED และ target ถูกต้อง | PASS |
| CFN drift | ตาม V5-7b | ตรวจพบ/กลับเป็น IN_SYNC | PASS (MODIFIED + IN_SYNC) |
| Amplify create/branch | `aws amplify get-app`; `aws amplify list-branches` | app/branch มีจริง (ถ้ามี token) | PASS (API probe, no stack) |
| Amplify build | `aws amplify get-job` | อาจ FAIL; ต้องบันทึกและใช้ fallback | N/A — not tested |
| Fallback frontend | `curl "$FRONT/dashboard/public"` | 200 และ proxy API ได้ | PASS |
| Lab session หมดอายุ | ปล่อยให้ session จบแล้วกลับมา | EC2 stopped; credentials ใช้ไม่ได้; ต้อง start/check ใหม่ | PASS (credentials expired) |

## หลักฐานที่ต้องเก็บ

- วันที่/เวลา UTC, บัญชี, region, ชื่อ stack และ stack ID
- `describe-stacks` output (เฉพาะ Status/Outputs ที่ไม่ลับ)
- SSM parameter **ชื่อ** และค่าที่ไม่ลับ; secret แสดงเฉพาะ key
- SSM command ID/status และ log ท้ายที่ไม่มีความลับ
- S3 key ของ backup และ `head-object` (ขนาด/เวลา)
- CloudWatch metric และ alarm state
- ภาพหน้าจอ Amplify job/fallback frontend (ถ้ามี)
- URL ของ GitHub Actions run และผล cfn-lint/cfn-guard
- ผล drift ก่อน/หลังแก้

## เกณฑ์ผ่าน

- ทุกข้อ V5-2 ถึง V5-8 มีผล PASS หรือมีเหตุผลที่ระบุชัดว่า N/A
- V5-3 ผ่านได้ด้วย fallback แม้ Amplify build ไม่ผ่าน แต่ต้องบันทึกว่า build ยังไม่ยืนยัน
- V5-5 เป็น N/A เพราะปิดเป็น not planned; ต้องยืนยันว่าไม่มี OIDC provider
- V5-6 ต้องมีหลักฐาน backup จริงและ restore จริงอย่างน้อยหนึ่งครั้ง
- V5-7 ต้องมีหลักฐาน lint/guard ผ่าน และ drift กลับเป็น IN_SYNC; GitHub Actions
  ยังไม่รันเพราะไม่ push ให้ระบุ TBD
- V5-8 ต้องมีตัวเลข before/after จาก Lab, teardown/recreate และลิงก์เอกสารครบ;
  หลักฐาน cs361-v5r ครอบคลุมแล้ว

## ข้อควรระวัง

- `seed` และ `restore` ทำลายข้อมูล; ใช้ stack ทดสอบและ backup ก่อน
- อย่าสร้าง IAM role/user/OIDC provider เพื่อทดสอบใน Lab
- อย่าเปิดพอร์ต 22 หรือใช้ SSH; ใช้ SSM เท่านั้น
- อย่า commit token, secret, `.env` หรือ output ที่มีรหัสผ่าน
- การทดสอบ drift โดยเพิ่ม ingress ต้อง revoke ทันทีและใช้ CIDR TEST-NET
- Amplify อยู่นอก supported list; ถ้าถูกบล็อกให้ใช้ fallback และบันทึกเป็นความเสี่ยง

## เอกสารที่เกี่ยวข้อง

- [Baseline V5](v5-baseline.md)
- [สถาปัตยกรรม V5](../architecture/v5-architecture.md)
- [คู่มือ deploy V5](../runbooks/v5-deploy.md)
- [ขอบเขต Learner Lab V5](../decisions/v5-learner-lab-scope.md)
