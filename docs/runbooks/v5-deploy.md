# คู่มือ deploy V5

> ใช้กับ branch `v5/automation` · วันที่: 8 พฤศจิกายน 2026
> สถาปัตยกรรม: [V5](../architecture/v5-architecture.md) · ขอบเขต Lab: [v5-learner-lab-scope.md](../decisions/v5-learner-lab-scope.md)
> ผลทดสอบ: [v5-validation.md](../evidence/v5-validation.md)

คู่มือนี้ใช้ `infra/new-account/deploy.sh` เป็นหลัก
ทุกคำสั่งรันจากรากของ repository ยกเว้นระบุไว้เป็นอย่างอื่น

## 1. สิ่งที่ต้องมี

| รายการ | ใช้ทำอะไร |
|---|---|
| AWS CLI v2 | สั่ง CloudFormation, SSM, S3, Secrets Manager |
| Python 3.11+ และ boto3 | `provision_cognito.py` (อยู่ใน `backend/requirements.txt`) |
| `git` | สร้าง tarball ของ `backend/`/`frontend/` |
| สิทธิ์ใน Learner Lab หรือบัญชี AWS | ใช้ `LabRole`/`LabInstanceProfile` ใน Lab |
| เครือข่ายออกไปยัง AWS | จาก CloudShell หรือเครื่องตัวเอง |

ไม่ต้องมี Docker บนเครื่องที่รัน `deploy.sh` เพราะ build เกิดบน EC2
ไม่ต้องมี SSH key และไม่ต้องเปิดพอร์ต 22

## 2. โหมดการทำงาน

| โหมด | `LAB_MODE` | Region | IAM |
|---|---|---|---|
| Learner Lab | `true` (หรือ auto-detect จาก role `voclabs`) | `us-west-2` | ใช้ `LabInstanceProfile`/`LabRole`; ไม่สร้าง role |
| บัญชีปกติ | `false` | `ap-southeast-2` (ค่าเริ่มต้น) | สร้าง `AppRole`/instance profile/`BackupSchedulerRole` |

ใน Lab ให้ตั้ง explicit เพื่อกันการ detect ผิด:

```bash
export AWS_REGION=us-west-2
export LAB_MODE=true
export STACK=cs361
export CONFIG_PREFIX=/cs361/config
```

> `LAB_MODE` เป็นตัวแปรของ `deploy.sh`; ชื่อ parameter ใน CloudFormation คือ `LabMode`
> (`deploy.sh` ส่งค่าให้เอง) ถ้าเรียก `aws cloudformation deploy` เอง ให้ส่ง `LabMode=true`

บัญชีปกติ:

```bash
export AWS_REGION=ap-southeast-2
export LAB_MODE=false
export AWS_PROFILE=cstu-new   # เฉพาะเมื่อใช้โปรไฟล์นี้; ถ้าใช้ credential chain ปกติไม่ต้องตั้ง
```

## 3. ตรวจก่อนเริ่ม

```bash
cd infra/new-account
./deploy.sh check
```

> หลังจากนี้คำสั่ง `./deploy.sh ...` ทั้งหมดใช้จากโฟลเดอร์ `infra/new-account`
> ถ้ากลับไปราก repo ให้ใช้ `./infra/new-account/deploy.sh ...` แทน

ต้องเห็น:

- identity ของบัญชี/role
- `Mode: true` และ `Region: us-west-2` ใน Lab
- service probes ผ่าน (CloudFormation, EC2, S3, Cognito, SSM, Secrets Manager, Scheduler, IAM read)

ถ้า probe ใดล้มเหลว ให้แก้ก่อน อย่าข้ามไปสร้าง stack
ใน Lab การสร้าง IAM role/OIDC ถูกปฏิเสธโดยเจตนา; `check` จะไม่ probe สิ่งเหล่านั้นเมื่อ `LAB_MODE=true`

## 4. ลำดับ deploy

### 4.1 Infrastructure (base stack)

```bash
./deploy.sh infra            # สร้าง change set ให้ตรวจ
./deploy.sh infra --apply    # สร้างจริง
```

ผลที่ต้องได้: stack `cs361` CREATE_COMPLETE และ outputs:

| Output | ใช้ต่อ |
|---|---|
| `InstanceId` | SSM Run Command, backup stack |
| `ApiBaseUrl` | API URL และ status |
| `BucketName` | backend, backup |
| `DbSecretArn` | backend |
| `ConfigPrefix` | ทุก stack |
| `InstanceProfileName` | ตรวจ Lab mode |
| `SecurityGroupId` | ตรวจ/แก้ ingress |
| `FrontendUrl` | fallback frontend |
| `SchedulerRoleArn` | backup stack |

ถ้า `LabMode=true` ต้องไม่เห็น `AppRole`/`AppInstanceProfile` ถูกสร้าง
และ EC2 ต้องใช้ `LabInstanceProfile`

### 4.2 Cognito

```bash
./deploy.sh cognito
./deploy.sh cognito --apply
```

สร้าง:

- user pool `cstu-v5-auth` (DeletionPolicy Retain)
- app client `cstu-backend`
- กลุ่ม `public`, `student`, `coordinator`, `staff`, `admin`
- SSM `/cs361/config/cognito_user_pool_id` และ `cognito_app_client_id`
- บัญชีทดสอบผ่าน `infra/provision_cognito.py` (รหัสผ่านเก็บแยกตาม pool ใน
  `~/.config/cstu/cognito-test-users-<pool-id>.txt`)

ห้ามพิมพ์หรือ commit ไฟล์รหัสผ่าน
ถ้า pool ชื่อซ้ำกับ stack เดิม ให้เปลี่ยน `POOL_NAME`/`COGNITO_STACK` หรือลบ stack เดิมก่อน

### 4.2.1 Local auth fallback (เมื่อ Cognito ใช้ไม่ได้)

Cognito เป็นค่าเริ่มต้นของ V5; local auth เป็น **fallback สำหรับ demo/lab**
ที่สร้าง Cognito ไม่ได้เท่านั้น ไม่ได้เปิดใน deployment `cs361` ปัจจุบัน

```bash
export AUTH_BACKEND=local

./deploy.sh infra --apply       # สร้าง LocalAuthSecret ใน Secrets Manager
# ข้าม ./deploy.sh cognito
./deploy.sh backend             # เขียน AUTH_BACKEND=local + LOCAL_AUTH_SECRET
./deploy.sh local-auth          # backend เรียกให้อัตโนมัติเมื่อ local; รันซ้ำเพื่อ rotate
./deploy.sh seed --yes
./deploy.sh status
```

รายละเอียด:

- `deploy.sh infra` สร้าง secret `LocalAuthSecret` และ SSM
  `${CONFIG_PREFIX}/local_auth_secret_arn` เฉพาะเมื่อ `AuthBackend=local`
- `deploy.sh backend` mount `/opt/cs361/local-auth` ไปที่ `/app/storage` ของ container
  และรัน `local_auth_setup.py`
- รหัสผ่าน local auth อยู่ที่ `/opt/cs361/local-auth/local-auth-users.txt` บน instance
  (โหมด `0600`); อ่านผ่าน SSM Session Manager เท่านั้น ห้ามพิมพ์/commit
- local auth ไม่มี MFA, password reset หรือ federation; ใช้เฉพาะ demo/lab
- ถ้าจะกลับไปใช้ Cognito อย่าสลับในฐานข้อมูลเดียวกันโดยไม่ล้าง local users
  เพราะ `users.email` เป็น unique และ local users ใช้ `cognito_sub=local:<email>`;
  ใช้ stack/DB ใหม่ หรือลบ users ที่ขึ้นต้นด้วย `local:` ก่อน

### 4.4 Fallback frontend บน EC2

```bash
./deploy.sh frontend --apply
```

`./deploy.sh frontend` โดยไม่มี `--apply` เป็นเพียง plan (แสดงสิ่งที่จะทำ)
คำสั่งนี้สร้าง container `cs361-frontend` บนพอร์ต 3000 ใช้ network `cs361`
proxy `/api/v1` ไป `http://cs361-backend:8000`
ตรวจ:

```bash
FRONT=$(aws cloudformation describe-stacks --stack-name cs361 \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" --output text)
curl -fsS "$FRONT/dashboard/public" >/dev/null && echo "frontend OK: $FRONT"
```

เครื่อง t3.micro มี RAM 1 GB; build frontend อาจช้า ให้รอหรือเพิ่ม `INSTANCE_TYPE`
ระหว่าง build ควรหลีกเลี่ยงการ build frontend พร้อม backend

### 4.4.1 HTTPS ด้วย Caddy (sslip.io)

ต้องมี frontend container รันอยู่ก่อน (ข้อ 4.4) และ security group เปิด 80/443
(`stack.yaml` เปิดไว้แล้ว)

```bash
# ไม่ต้องตั้ง SITE_DOMAIN ก็ได้: ค่าเริ่มต้นคือ <Elastic-IP>.sslip.io
./deploy.sh tls
```

ค่าเริ่มต้นจะได้:

```text
https://<Elastic-IP>.sslip.io/dashboard/public
```

ถ้ามีโดเมนจริง ให้ชี้ A record มาที่ Elastic IP แล้วรัน:

```bash
SITE_DOMAIN=cs361.example.com ./deploy.sh tls
```

Caddy จะขอ certificate จาก Let's Encrypt อัตโนมัติ และเก็บ cert ไว้ที่
`/opt/cs361/caddy` บน EBS (อยู่ต่อหลัง restart)
Caddy reverse proxy ไปที่ `cs361-frontend:3000`; frontend proxy `/api/v1`
ไป backend ภายใน Docker network เดิม

ข้อจำกัด:
- ต้องเปิด 80/443 และ DNS ต้องชี้มาที่ EIP
- ถ้า EIP เปลี่ยน ต้องรัน `tls` ใหม่ (ปกติ EIP คงที่)
- API port 8000 ยังเปิดแบบ HTTP สำหรับ fallback path; ถ้าต้องการปิด
  ให้ทำเป็น hardening แยก (ต้องแก้ `ApiBaseUrl`/health check ด้วย)

### 4.5 Backend

```bash
./deploy.sh backend
```

ขั้นนี้:

1. อัปโหลด `backend/` ขึ้น S3 เป็น `deploy/backend-<timestamp>.tgz`
2. อ่าน SSM + Secrets Manager แล้วเขียน `/opt/cs361/.env` (สิทธิ์ 600)
3. build image `cs361-backend:<timestamp>`
4. เปิด container ใหม่และตรวจ `/api/v1/health` 30 ครั้ง (ทุก 2 วินาที)
5. ถ้าไม่ผ่าน พิมพ์ log และ exit ไม่เป็นศูนย์

CORS ถูกเลือกตามลำดับ: `CORS_ORIGINS` (ถ้าตั้ง) → `FrontendUrl` → SSM
จึง **ไม่ต้อง deploy backend ซ้ำ** หลังสร้าง frontend เหมือน V4
ถ้าต้องการกำหนดเอง:

```bash
CORS_ORIGINS="https://<domain>,http://<EIP>:3000" ./deploy.sh backend
```

### 4.6 Seed

```bash
./deploy.sh backup    # ถ้ามีข้อมูลเดิม
./deploy.sh seed --yes
```

`seed` **ลบข้อมูลทั้งหมดใน `cstu_demo`** และใส่ข้อมูลสมมติ
ต้องมี `--yes`; ไม่มีคำสั่ง undo นอกจาก restore backup

### 4.7 Schedule backup

```bash
ALERT_EMAIL=you@example.com ./deploy.sh schedule
ALERT_EMAIL=you@example.com ./deploy.sh schedule --apply
```

สร้าง:

- SNS topic `cs361-backup-alerts` (ถ้ามี email จะมี subscription; ต้องกดยืนยันในอีเมล)
- SSM document `cs361-backup`
- EventBridge Scheduler `cs361-backup` (ค่าเริ่มต้น `rate(1 day)`)
- CloudWatch alarm `cs361-backup-failed` (missing metric = breaching)

ตรวจ:

```bash
aws scheduler get-schedule --name cs361-backup \
  --query '[State,ScheduleExpression,Target.Arn]' --output table
aws cloudwatch describe-alarms --alarm-names cs361-backup-failed \
  --query 'MetricAlarms[0].[StateValue,TreatMissingData]' --output table
```

ใน Lab schedule ทำงานเฉพาะเมื่อ session เปิดและ EC2 ทำงาน
ครั้งที่ทดสอบ `cs361-backup` เป็น ENABLED และรันสำเร็จด้วย `LabRole`
ถ้า session ปิดหรือไม่มั่นใจ ให้รัน `./deploy.sh backup` ด้วยมือ
หลัง apply ครั้งแรก alarm อาจเป็น `ALARM` เพราะยังไม่มี metric; รัน backup หนึ่งครั้งเพื่อให้ค่า `BackupSuccess=1`

### 4.8 ตรวจสถานะ

```bash
./deploy.sh status
```

ต้องเห็น API health และ frontend (`FrontendUrl` หรือ HTTPS domain) ตอบสนอง

## 5. งานประจำ

### 5.1 Backup ด้วยมือ

```bash
./deploy.sh backup
BUCKET=$(aws cloudformation describe-stacks --stack-name cs361 \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
aws s3 ls "s3://$BUCKET/backups/" | tail
```

ไฟล์อยู่ใต้ `backups/` และถูกลบตาม `BACKUP_RETENTION_DAYS` (ค่าเริ่มต้น 30)

### 5.2 Restore

```bash
./deploy.sh restore backups/cstu_demo-YYYYMMDDTHHMMSSZ.sql.gz --yes
```

- หยุด backend ชั่วคราวระหว่าง restore
- เขียนทับฐานข้อมูลปัจจุบัน
- ควร backup ก่อน restore เสมอ
- ทดสอบบน stack ทดสอบก่อนใช้กับข้อมูลสำคัญ

### 5.3 หมุนรหัสผ่านฐานข้อมูล

V5 ไม่มี subcommand `rotate` แยก; ใช้ Secrets Manager + `deploy.sh backend`
ซึ่งจะอ่าน secret ใหม่และ `ALTER USER` ให้ตรงกัน

```bash
# 1) อ่าน secret ARN
SECRET_ARN=$(aws ssm get-parameter --name /cs361/config/db_secret_arn \
  --region "$AWS_REGION" --query Parameter.Value --output text)

# 2) สร้างรหัสใหม่แบบ hex (ไม่มีอักขระพิเศษที่ทำให้ SQL quote ผิด)
NEW_PASS=$(openssl rand -hex 24)

# 3) อัปเดต JSON โดยคง username/dbname เดิม
CURRENT=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" \
  --region "$AWS_REGION" --query SecretString --output text)
NEW_JSON=$(printf '%s' "$CURRENT" | NEW_PASS="$NEW_PASS" python3 -c \
  'import json,os,sys; d=json.load(sys.stdin); d["password"]=os.environ["NEW_PASS"]; print(json.dumps(d))')
aws secretsmanager put-secret-value --secret-id "$SECRET_ARN" \
  --region "$AWS_REGION" --secret-string "$NEW_JSON"
unset NEW_PASS CURRENT NEW_JSON

# 4) ให้ EC2 อ่าน secret ใหม่และเปลี่ยนรหัสใน PostgreSQL
./deploy.sh backend
```

ตรวจว่า health ผ่านและรหัสเก่าใช้ไม่ได้
ถ้า backend เก่า/DB ถูกสร้างด้วยรหัสอื่น ให้ดู troubleshooting

## 6. Self-hosted runner สำหรับ GitHub Actions

ส่วนนี้เป็น **manual bootstrap** สำหรับ runner ที่ใช้กับ CI job `plan`/`drift`
และสำหรับ automate backend deploy ในอนาคต
`infra.yml` ใช้ label `cs361`; workflow deploy backend ยังไม่ถูกเพิ่มใน V5
และ V5-5 (OIDC) ถูกปิดเป็น not planned

### 6.1 สร้าง runner EC2

- แยกจาก backend instance (อย่าใช้เครื่องเดียวกับ DB/API)
- Amazon Linux 2023, t3.micro, ไม่มี key pair, ไม่เปิด inbound
- attach `LabInstanceProfile`
- เปิด SSM agent (Amazon Linux 2023 มีมาให้) และใช้ Session Manager/Run Command
- ติดตั้งเฉพาะเมื่อต้องใช้ แล้วหยุดเครื่องเมื่อไม่ใช้เพื่อประหยัดเครดิต

### 6.2 ติดตั้ง runner

เปิด session ผ่าน SSM (ไม่ใช้ SSH):

```bash
aws ssm start-session --target "$RUNNER_INSTANCE_ID" --region us-west-2
```

บนเครื่อง:

```bash
sudo dnf install -y git libicu
aws --version || echo "ติดตั้ง AWS CLI v2 ก่อน (ตามเอกสาร AWS)"
python3 --version
sudo useradd -m -s /bin/bash runner || true
sudo -u runner bash
cd /home/runner

# เปลี่ยน <version> เป็นเวอร์ชันที่ต้องการ
curl -fsSL -o runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v<version>/actions-runner-linux-x64-<version>.tar.gz"
tar xzf runner.tar.gz

./config.sh \
  --url https://github.com/<owner>/<repo> \
  --token <RUNNER_TOKEN> \
  --labels cs361 \
  --unattended

sudo ./svc.sh install runner
sudo ./svc.sh start
```

`RUNNER_TOKEN` เอามาจาก GitHub → Settings → Actions → Runners → New self-hosted runner
(token อายุสั้น; ไม่เก็บใน repo) ตรวจว่า runner ออนไลน์ใน GitHub

หลัง runner ออนไลน์ ให้ตั้ง repository variable:

```text
Settings → Secrets and variables → Actions → Variables
ENABLE_SELF_HOSTED_CI = true
```

ถ้าไม่ตั้ง `plan`/`drift` จะถูก skip (กันไม่ให้ scheduled job ค้าง/FAIL
ตอนที่ยังไม่มี runner)

### 6.3 Workflow ตัวอย่าง (ยังไม่อยู่ใน repo)

ใช้ `workflow_dispatch` เพื่อไม่ให้ deploy ทุก push โดยไม่ตั้งใจ:

```yaml
name: deploy-backend
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  deploy:
    runs-on: [self-hosted, cs361]
    steps:
      - uses: actions/checkout@v4
      - name: Deploy over SSM
        env:
          AWS_REGION: us-west-2
          LAB_MODE: "true"
        run: |
          ./infra/new-account/deploy.sh check
          ./infra/new-account/deploy.sh backend
```

- runner ใช้ `LabInstanceProfile` จึงไม่ต้องตั้ง `AWS_ACCESS_KEY_ID`
- `deploy.sh` ใช้ AWS credential chain ปกติ; บน EC2 จะใช้ instance profile
- จำกัด workflow ให้รันเฉพาะ branch ที่เชื่อถือ และไม่รับ PR จาก fork
- pin action ด้วย commit SHA ในงานจริง

## 7. Rollback

### 7.1 Backend

ถ้า deploy เวอร์ชันใหม่แล้ว health ไม่ผ่าน:

```bash
# ใช้ worktree ของ commit ก่อนหน้า (เฉพาะ commit ที่เข้ากับ V5)
git worktree add /tmp/cs361-rollback <previous-sha>
cd /tmp/cs361-rollback/infra/new-account
AWS_REGION=us-west-2 LAB_MODE=true ./deploy.sh backend
```

ถ้า commit ก่อนหน้าเป็น V4 ที่ยังไม่รู้จัก SSM/Secrets ของ V5
ให้ใช้ backup/restore และ deploy โค้ด V5 รุ่นก่อนหน้าที่เข้ากันแทน
อย่า rollback ฐานข้อมูลอัตโนมัติ; ใช้ `./deploy.sh restore` เมื่อจำเป็น

### 7.2 Frontend

- **Fallback**: revert commit แล้ว `./deploy.sh frontend --apply`
- ถ้าใช้ HTTPS/Caddy: restart container `cs361-caddy` หรือรัน `./deploy.sh tls` ใหม่

### 7.3 CloudFormation

```bash
aws cloudformation describe-stack-events --stack-name cs361 --max-items 20
aws cloudformation cancel-update-stack --stack-name cs361        # ถ้ายังอัปเดตอยู่
aws cloudformation continue-update-rollback --stack-name cs361   # ถ้า UPDATE_ROLLBACK_FAILED
```

ถ้า stack สร้างไม่สำเร็จและแก้ไม่ได้ ให้ `delete-stack` แล้ว deploy ใหม่
หลัง backup ข้อมูลที่ต้องการ

### 7.4 ฐานข้อมูล

```bash
./deploy.sh backup
./deploy.sh restore backups/<key>.sql.gz --yes
```

## 8. Teardown

```bash
# เก็บ S3 bucket และ Cognito pool ไว้ (เผื่อ restore/ตรวจย้อนหลัง)
./deploy.sh backup
./deploy.sh teardown --yes
```

```bash
# ลบทุกอย่างรวม S3 และ Cognito เพื่อสร้างใหม่ให้สะอาด
./deploy.sh backup
./deploy.sh teardown --yes --purge
```

ลำดับที่สคริปต์ลบ: backup → cognito → base
สิ่งที่ถูกลบทุกกรณี: EC2, EBS/ฐานข้อมูล, secret, SSM parameter ของ stack, schedule/alarm
สิ่งที่ถูก Retain เมื่อไม่มี `--purge`: S3 bucket (รวม `backups/`) และ Cognito user pool
`--purge` จะลบ S3 bucket (ทุก object/version) และ Cognito user pool ด้วย
จึงใช้เมื่อต้องการ recreate จากศูนย์เท่านั้น และควร backup ก่อนทุกครั้ง

## 9. Troubleshooting

| อาการ | สาเหตุที่พบบ่อย | วิธีแก้ |
|---|---|---|
| `check` ผ่านบาง probe/region ผิด | ใช้ region นอก `us-east-1`/`us-west-2` | `export AWS_REGION=us-west-2`; อย่าใช้ Sydney ใน Lab |
| runner ใช้ credential ผิด | instance profile ไม่ถูก attach หรือ `AWS_PROFILE` ชี้ผิด | ตรวจ `aws sts get-caller-identity` บน runner; ใช้ `LabInstanceProfile` |
| `infra` ล้มเหลวเรื่อง IAM | `LAB_MODE` ไม่ใช่ `true` | `export LAB_MODE=true`; ห้ามสร้าง role เอง |
| `cognito` สร้าง pool ไม่ได้/ชื่อซ้ำ | pool ชื่อเดิมมีอยู่ | เปลี่ยน `POOL_NAME`/`COGNITO_STACK` หรือลบ stack เดิม |
| `backend` ค้างที่ SSM | EC2 stopped, SSM agent ไม่ทำงาน, หรือ profile ผิด | start instance; ตรวจ `aws ssm describe-instance-information`; ดู `get-command-invocation` |
| backend health ไม่ผ่าน | secret ผิด, DB ยังไม่พร้อม, CORS/env ผิด | `docker logs cs361-backend`; ตรวจ `db.env`/`.env`; อย่าพิมพ์รหัสผ่าน |
| backup ไม่ขึ้น S3 | schedule ไม่ทำงาน/สิทธิ์ S3/สคริปต์ไม่ถูกอัปโหลด | รัน `./deploy.sh backup`; ตรวจ `backup.sh` บนเครื่อง; ดู SSM command |
| ไม่มีอีเมลแจ้งเตือน | ยังไม่ยืนยัน SNS subscription | กดยืนยันในอีเมล; ตรวจ `list-subscriptions-by-topic` |
| restore ล้มเหลว | key ผิด, gzip เสีย, พื้นที่ดิสก์ | ตรวจ `aws s3 ls`; `gzip -t`; ตรวจ disk บน EC2 |
| drift หลังจากแก้ Console | resource ถูกแก้ manual | ดู `describe-stack-resource-drifts`; `./deploy.sh infra --apply` |
| credentials หมดอายุ | จบ Lab session | เปิด Lab ใหม่; เริ่มที่ `check`; อย่าใช้ key เก่า |
| `teardown` ค้าง | stack มี resource ที่ลบยาก/S3 retain | ดู stack events; `--purge` ลบ S3/Cognito ที่ retain; ถ้ายังค้างให้ลบ stack ทีละตัว |

## 10. สิ่งที่ห้ามทำ

- **ห้ามสร้าง IAM user/group/role/policy หรือ OIDC provider ใน Learner Lab**
  (V5-5 ปิดเพราะข้อจำกัดนี้)
- **ห้ามเปิดพอร์ต 22 หรือใช้ SSH**; ใช้ SSM Session Manager/Run Command เท่านั้น
- **ห้าม commit หรือพิมพ์** token, รหัสผ่าน, `.env`, secret JSON
- **ห้ามรัน `seed` หรือ `restore`** โดยไม่มี backup และไม่มี `--yes` เมื่อตั้งใจ
- **ห้ามรัน `teardown`** ก่อน backup
- **`teardown --purge` ลบ S3 และ Cognito ถาวร**; ใช้เฉพาะเมื่อต้องการ recreate
- **ห้ามใช้ region อื่น** ใน Lab นอก `us-east-1`/`us-west-2`
- **ห้ามรัน workflow จาก fork/PR** บน self-hosted runner ที่ใช้ `LabRole`
- **ห้ามแก้ shared interface** (ชื่อ stack, `ConfigPrefix`, output, secret JSON)
  โดยไม่แจ้ง lead

## 11. สรุปคำสั่ง

| งาน | คำสั่ง |
|---|---|
| ตรวจ | `./deploy.sh check` |
| สร้าง base | `./deploy.sh infra --apply` |
| Cognito | `./deploy.sh cognito --apply` |
| Local auth (fallback) | `AUTH_BACKEND=local ./deploy.sh infra --apply` → `AUTH_BACKEND=local ./deploy.sh backend` (auto local-auth) |
| Fallback frontend | `./deploy.sh frontend --apply` |
| HTTPS (Caddy) | `./deploy.sh tls` (หรือ `SITE_DOMAIN=... ./deploy.sh tls`) |
| Backend | `./deploy.sh backend` |
| Seed | `./deploy.sh seed --yes` |
| Schedule | `ALERT_EMAIL=... ./deploy.sh schedule --apply` |
| Status | `./deploy.sh status` |
| Backup | `./deploy.sh backup` |
| Restore | `./deploy.sh restore <s3-key> --yes` |
| หมุนรหัสผ่าน | update secret → `./deploy.sh backend` |
| Teardown (เก็บ S3/Cognito) | `./deploy.sh backup && ./deploy.sh teardown --yes` |
| Teardown (ลบทั้งหมด) | `./deploy.sh backup && ./deploy.sh teardown --yes --purge` |

## เอกสารที่เกี่ยวข้อง

- [สถาปัตยกรรม V5](../architecture/v5-architecture.md)
- [Baseline V5](../evidence/v5-baseline.md)
- [แผนทดสอบ V5](../evidence/v5-validation.md)
- [ขอบเขต Learner Lab V5](../decisions/v5-learner-lab-scope.md)
- [ช่องทาง deploy backend V5](../decisions/v5-backend-deploy.md)
