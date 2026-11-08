# V5 Amplify spike (Learner Lab) — 2026-11-08

> บันทึกของ #120 V5-3: ทดสอบว่า AWS Amplify Hosting ใช้เป็น IaC สำหรับ frontend ได้หรือไม่
> สรุป: สร้าง app และ branch ผ่าน API ได้ แต่ build Next.js 16 SSR ยังพิสูจน์ไม่ได้ใน Learner Lab
> จึงเตรียม fallback ให้ frontend รันเป็น container บน EC2 เครื่องเดียวกับ backend

## สิ่งที่ตรวจสอบใน Learner Lab (2026-11-08)

บัญชี `073362813452` (role `voclabs`) region `us-west-2`:

| รายการ | ผล |
|---|---|
| `aws amplify create-app` | ผ่าน สร้าง app ได้ |
| `aws amplify create-branch` | ผ่าน สร้าง branch `main` ได้ |
| Amplify อยู่ในรายการบริการที่ Learner Lab รองรับอย่างเป็นทางการ | **ไม่ใช่** (อยู่นอก supported services list) |
| สร้าง IAM service role สำหรับ Amplify (`iam:CreateRole`) | ไม่ได้ ถูกปฏิเสธ |
| `start-job` แล้ว build Next.js 16 SSR สำเร็จ | **ยังไม่ยืนยัน** เพราะไม่มี service role |

Next.js 16 ในโปรเจกต์ใช้ `output: 'standalone'` (`frontend/next.config.js`) ซึ่งเป็น SSR
การ build บน Amplify ต้องมี service role ให้ compute และใช้ CloudFront/Lambda@Edge เบื้องหลัง
เมื่อสร้าง role ไม่ได้ จึงยังสรุปไม่ได้ว่า build ผ่าน

เทมเพลต `infra/new-account/amplify.yaml` จึง **ไม่สร้าง IAM role** ใช้ parameter
`AmplifyServiceRoleArn` รับ role ที่มีอยู่แล้ว (บัญชีปกติ) หรือปล่อยว่างให้ Amplify จัดการเอง
ถ้า `OauthTokenSecretArn` ว่าง stack จะไม่สร้าง Amplify resource ใด ๆ และ `deploy.sh amplify`
จะใช้ fallback บน EC2

หมายเหตุ: เอกสาร AWS ระบุว่าสำหรับ GitHub ต้องใช้ `AccessToken` (personal access token
ของ Amplify GitHub App) ไม่ใช่ `OauthToken` ซึ่งใช้กับ Bitbucket/CodeCommit
เทมเพลตใช้ property `AccessToken` โดยคงชื่อ parameter `OauthTokenSecretArn` และ secret key
`token` ตาม interface ของ V5

## ทดสอบ CloudFormation template (เมื่อมี GitHub token ใน Secrets Manager)

ต้องมี token ที่อ่าน repo ได้ (fine-grained PAT, สิทธิ์ Contents: Read)
ตั้ง region เป็น `us-west-2` และรันจาก root ของ repo

### 1) สร้าง secret และเอา ARN

```bash
aws secretsmanager create-secret \
  --name cs361/github-token \
  --region us-west-2 \
  --secret-string '{"token":"github_pat_..."}'

TOKEN_ARN=$(aws secretsmanager describe-secret \
  --secret-id cs361/github-token \
  --region us-west-2 \
  --query ARN --output text)
```

### 2) Deploy stack

`ApiBaseUrl` เอามาจาก output ของ base stack (`http://<Elastic IP>:8000`)

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name cs361 \
  --region us-west-2 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" \
  --output text)

aws cloudformation deploy \
  --stack-name cs361-amplify \
  --region us-west-2 \
  --template-file infra/new-account/amplify.yaml \
  --parameter-overrides \
      ProjectName=cs361 \
      ApiBaseUrl="$API_URL" \
      OauthTokenSecretArn="$TOKEN_ARN"
```

ในบัญชีปกติที่สร้าง role ไว้แล้ว ให้เพิ่ม `AmplifyServiceRoleArn=<role-arn>` ใน
`--parameter-overrides`; ใน Learner Lab ไม่ต้องใส่ เพราะสร้าง role ไม่ได้

### 3) เริ่ม build และดูสถานะ

```bash
APP_ID=$(aws cloudformation describe-stacks \
  --stack-name cs361-amplify \
  --region us-west-2 \
  --query "Stacks[0].Outputs[?OutputKey=='AppId'].OutputValue" \
  --output text)

JOB_ID=$(aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name main \
  --job-type RELEASE \
  --region us-west-2 \
  --query jobSummary.jobId \
  --output text)

aws amplify get-job \
  --app-id "$APP_ID" \
  --branch-name main \
  --job-id "$JOB_ID" \
  --region us-west-2 \
  --query 'job.summary.status' \
  --output text
```

ตรวจ URL ที่เขียนลง SSM และดู job ทั้งหมด:

```bash
aws ssm get-parameter \
  --name /cs361/config/amplify_url \
  --region us-west-2 \
  --query Parameter.Value \
  --output text

aws amplify list-jobs \
  --app-id "$APP_ID" \
  --branch-name main \
  --region us-west-2 \
  --query 'jobSummaries[].[jobId,status,startTime,endTime]' \
  --output table
```

### 4) ลบ app

ลบผ่าน stack เพื่อให้ resource ที่เหลือถูกลบตามไปด้วย:

```bash
aws cloudformation delete-stack --stack-name cs361-amplify --region us-west-2
aws cloudformation wait stack-delete-complete --stack-name cs361-amplify --region us-west-2
```

ถ้า app ถูกสร้าง manually (ไม่อยู่ใน stack) ให้ลบด้วย:

```bash
aws amplify delete-app --app-id "$APP_ID" --region us-west-2
```

## Fallback: frontend container บน EC2

ถ้า Amplify ใช้ไม่ได้หรือไม่มี token ให้รัน frontend เป็น Docker container บนเครื่องเดียวกับ
backend ที่พอร์ต 3000 โดยใช้ network `cs361`:

- `API_PROXY_TARGET=http://cs361-backend:8000` — Next.js proxy `/api/v1/*` ไป backend ภายใน Docker network
- `NEXT_PUBLIC_API_URL=/api/v1` — เบราว์เซอร์เรียก API ที่ origin เดียวกับหน้าเว็บ
- เปิด security group พอร์ต 3000 (base stack เปิดไว้แล้ว) เข้าที่ `http://<Elastic IP>:3000`
- CORS: ถ้าใช้ proxy แบบ same-origin ไม่ต้องเพิ่ม origin; ถ้าเรียก API ตรงให้ตั้ง
  `CORS_ORIGINS=http://<Elastic IP>:3000` แล้วรัน `deploy.sh backend` ใหม่

```bash
# deploy.sh frontend --apply อัปโหลด frontend/ ขึ้น S3 แล้ว build บน EC2 ให้เอง
infra/new-account/deploy.sh frontend --apply
```

ถ้าต้องการรันมือบน EC2 ใน `/opt/cs361`:

```bash
docker build -t cs361-frontend frontend \
  --build-arg API_PROXY_TARGET=http://cs361-backend:8000 \
  --build-arg NEXT_PUBLIC_API_URL=/api/v1

docker rm -f cs361-frontend 2>/dev/null || true
docker run -d --name cs361-frontend --network cs361 --restart unless-stopped \
  -p 3000:3000 cs361-frontend

curl -fsS http://localhost:3000/dashboard/public >/dev/null && echo OK
```

## ความเสี่ยงที่ยังเปิดอยู่

- เทมเพลตผ่านการตรวจ YAML และโครงสร้างแล้ว แต่ยังไม่ได้ deploy จริง เพราะยังไม่มี GitHub token ใน Secrets Manager
- build Next.js 16 บน Amplify ยังไม่ยืนยัน ต้องทดสอบในบัญชีปกติหรือ Lab session ถัดไป
- Amplify ไม่อยู่ใน supported services list ของ Learner Lab จึงอาจถูกบล็อกภายหลังโดยไม่แจ้ง
- fallback บน EC2 ใช้ได้ทันทีและไม่พึ่งบริการนอก supported list แต่เพิ่มภาระ RAM ของเครื่อง t3.micro
