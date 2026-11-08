# การตัดสินใจ: ช่องทาง deploy backend ของ V5

> สถานะ: ตกลง · วันที่: 8 พฤศจิกายน 2026 · เกี่ยวข้อง: #118 (V5-1), V5-5 (#122)
> V5-5 (#122) ถูกปิดเป็น **not planned** เพราะ GitHub OIDC สร้างไม่ได้ใน Learner Lab
> เอกสารนี้บันทึกแนวทางที่เลือกแทน และข้อจำกัดที่ต้องยอมรับ

## บริบท

V4 deploy backend ด้วย `deploy.sh backend` จาก CloudShell หรือเครื่องผู้ดูแล
สคริปต์อัปโหลด `backend/` ขึ้น S3 แล้วสั่ง EC2 ผ่าน SSM Run Command ให้ build และเปิด container ใหม่
วิธีนี้ทำงานได้ แต่ยังต้องมีคนสั่งและเฝ้าดูผล

V5 ต้องการให้ backend deploy ซ้ำได้จาก GitHub Actions โดยไม่เก็บ AWS key ระยะยาวใน GitHub
แต่ Learner Lab มีข้อจำกัดที่ตรวจแล้ว (8 พฤศจิกายน 2026, บัญชี `073362813452`, role `voclabs`):

- สร้าง IAM user/group/role/policy ไม่ได้
- `iam:CreateOpenIDConnectProvider` ถูกปฏิเสธ ทำให้ GitHub OIDC ใช้ไม่ได้
- `LabRole` และ `LabInstanceProfile` มีอยู่แล้ว และ EC2 ใช้ได้
- SSM Run Command ใช้ได้ และ EC2 ที่มี `LabInstanceProfile` สั่งงานได้

## การตัดสินใจ

เลือก **self-hosted GitHub Actions runner บน EC2 + SSM Run Command + LabRole** สำหรับ automation ของ backend deploy

องค์ประกอบ:

1. **Runner EC2 แยกจาก backend** (แนะนำ t3.micro, Amazon Linux 2023)
   ใช้ `LabInstanceProfile` ไม่เปิด SSH และดูแลผ่าน SSM Session Manager/Run Command
2. **GitHub Actions workflow** รันบน label `self-hosted` + `cs361`
   (ใช้ label `cs361` เดียวกับที่ `.github/workflows/infra.yml` ใช้กับ job `plan`/`drift`)
   เรียก `infra/new-account/deploy.sh backend` จาก checkout ของ repo
3. **`deploy.sh backend`** อัปโหลด tarball ขึ้น S3, อ่านค่า config จาก SSM/Secrets Manager,
   สั่ง EC2 ผ่าน `aws ssm send-command` และตรวจ `/api/v1/health`
4. **LabRole** ให้สิทธิ์ runner เรียก SSM, S3, CloudFormation และ Secrets Manager
   โดยไม่ต้องสร้าง role ใหม่หรือเก็บ access key ใน GitHub

> ขอบเขต V5: เอกสารนี้และ [runbook](../runbooks/v5-deploy.md) เตรียมขั้นตอนไว้
> แต่ V5 **ยังไม่เพิ่ม workflow deploy backend ลงใน `.github/workflows/`**
> การ deploy ที่ใช้จริงใน V5 จึงยังเป็น `deploy.sh backend` จาก CloudShell/เครื่องผู้ดูแล
> การติดตั้ง runner เป็น manual bootstrap ครั้งเดียว ไม่ได้สร้างด้วย CloudFormation
> เพราะการสร้าง IAM role สำหรับ runner ถูกปฏิเสธใน Lab
>
> runner เดียวกันนี้ถูกใช้โดย job `plan`/`drift` ของ `.github/workflows/infra.yml`
> (label `cs361`) ซึ่งสร้าง change set และตรวจ drift เท่านั้น ไม่ได้ apply หรือ deploy

## ทางเลือกที่พิจารณา

| ทางเลือก | ข้อดี | ข้อเสีย / เหตุผลที่ไม่เลือก |
|---|---|---|
| **Self-hosted runner + SSM + LabRole** | ไม่ต้องสร้าง IAM, ไม่มี AWS key ใน GitHub, ใช้ `deploy.sh` เดิม, ตรวจ health ได้ | runner ต้องเปิดเครื่องและดูแลเอง, LabRole กว้างเกิน least privilege, ใช้ได้เฉพาะ repo ที่เชื่อถือ |
| GitHub OIDC | มาตรฐานที่สุด ไม่มี key ระยะยาว | `iam:CreateOpenIDConnectProvider` ถูกปฏิเสธ; V5-5 ปิดเป็น not planned |
| IAM user + access key ใน GitHub Secrets | ตั้งค่าง่าย | สร้าง IAM user ไม่ได้ และเป็น key ระยะยาวที่ต้องหมุน |
| CodeDeploy | จัดการ deployment lifecycle และ rollback ให้ | ต้องมี service role (สร้างไม่ได้), ต้องติดตั้ง agent, เพิ่ม `appspec.yml` และ revision ของ S3; ซับซ้อนกว่า SSM ที่ใช้อยู่ |
| ECS/Fargate | จัดการ container, scale, health check | ต้องมี IAM role, ECR, load balancer; ค่าใช้จ่ายและงาน migration สูง; ไม่เหมาะกับ EC2 เครื่องเดียว |
| SSH/scp จาก runner | คุ้นเคย | ไม่เปิดพอร์ต 22 และไม่มี key; ขัดกับหลัก SSM-only ของ V4 |
| Deploy ด้วยมือจาก CloudShell อย่างเดียว | ทำงานได้แล้ว | ไม่ใช่ automation, ต้องมีคนเฝ้า, ไม่มีหลักฐานว่า deploy ผ่าน CI |

## ค่าใช้จ่าย

ตัวเลขเป็นค่าประมาณจากราคา on-demand ของ `us-west-2` (พฤศจิกายน 2026)
และยังไม่รวมเครดิต Learner Lab:

| รายการ | ค่าประมาณต่อเดือน (เปิดตลอด) |
|---|---|
| Runner EC2 t3.micro | ~$7.6 |
| EBS gp3 20 GB | ~$1.6 |
| Public IPv4 | ~$3.7 |
| **รวม runner** | **~$12–13** |
| GitHub Actions self-hosted minutes | $0 (ไม่กิน hosted minutes) |
| CodeDeploy service | $0 แต่ต้องมี EC2 และ agent |
| ECS/Fargate + ALB | สูงกว่าอย่างน้อยหลายเท่า (ALB อย่างเดียว ~$16+/เดือน) |

ถ้าเปิด runner เฉพาะช่วง deploy และหยุดเมื่อไม่ใช้ ค่าใช้จ่ายจะเหลือใกล้ศูนย์ใน Lab
แต่ต้องยอมรับว่า scheduled backup และ workflow จะไม่ทำงานขณะเครื่องหยุด
จึงไม่ควรใช้ runner เครื่องเดียวกับ backend (RAM 1 GB และ LabRole เดียวกัน) เพื่อลดผลกระทบตอน build

## การออกแบบ health check และ rollback

### สิ่งที่ `deploy.sh backend` ทำอยู่แล้ว

1. สร้าง tarball `deploy/backend-<timestamp>.tgz` และอัปโหลดขึ้น S3
2. อ่าน `db_secret_arn` จาก SSM แล้วดึง JSON จาก Secrets Manager
3. เขียน `.env` บน EC2 (สิทธิ์ `600`) รวม `DATABASE_URL`, `S3_BUCKET`, `COGNITO_*`, `CORS_ORIGINS`
4. build image `cs361-backend:<timestamp>` และเปิด container ใหม่
5. ตรวจ `http://localhost:8000/api/v1/health` ซ้ำ 30 ครั้ง (ทุก 2 วินาที)
6. ถ้าไม่ผ่าน ให้พิมพ์ log 50 บรรทัดและ exit ไม่เป็นศูนย์; SSM command รายงาน `Failed`

### ข้อเสนอสำหรับ rollback อัตโนมัติ (ยังไม่ implement ใน V5)

- ก่อนลบ container เดิม ให้ tag image ปัจจุบันเป็น `cs361-backend:previous`
  และเก็บ `.env` เดิมเป็น `.env.previous`
- ถ้า health check ของ image ใหม่ไม่ผ่าน ให้ start `cs361-backend:previous` ด้วย `.env.previous`
  แล้วรายงาน `Rollback=success` ผ่าน CloudWatch/SSM output
- เก็บ image ใหม่อย่างน้อยหนึ่งรุ่นเพื่อ debug; ลบเมื่อผ่านรอบถัดไป
- ห้าม rollback ฐานข้อมูลอัตโนมัติ เพราะ schema อาจเปลี่ยน; ให้ใช้ backup/restore เมื่อจำเป็น

> **สถานะ V5:** `deploy.sh` ตรวจ health และทำให้ step ล้มเหลว แต่ยังไม่มี rollback อัตโนมัติ
> runbook จึงให้ rollback ด้วยการ deploy commit ก่อนหน้าหรือ restore backup
> นี่เป็นช่องว่างที่ต้องปิดก่อนใช้ runner กับ production

### Health check ของ workflow

- workflow ต้องถือว่า SSM command ที่ `Failed` เป็น deploy ล้มเหลว
- ตรวจ `/api/v1/health` จาก runner หรือจาก CloudShell หลัง deploy
- เก็บ `CommandId`, `InstanceId`, `Status`, `ResponseCode` และ log ท้าย 60 บรรทัดเป็นหลักฐาน
- ไม่พิมพ์ค่า secret หรือ `DATABASE_URL` ลง log

## ความปลอดภัย

- **LabRole กว้าง**: runner ที่ใช้ `LabInstanceProfile` มีสิทธิ์มากกว่าที่ workflow ต้องการ
  ใช้เฉพาะ repo นี้และ branch ที่เชื่อถือ; ห้ามรัน workflow จาก fork/PR ที่ไม่น่าเชื่อถือ
- **Workflow permissions**: ตั้ง `permissions: contents: read` และใช้ `workflow_dispatch`
  หรือ environment protection สำหรับ deploy
- **ไม่เก็บ key**: ไม่มี `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` ใน GitHub Secrets
- **ไม่เปิด SSH**: runner และ backend ใช้ SSM เท่านั้น; security group ไม่มีพอร์ต 22
- **จำกัด action**: pin action ด้วย commit SHA และหลีกเลี่ยง action ที่ไม่จำเป็นบน self-hosted runner
- **Runner token**: registration token อายุสั้น ใช้แล้วลบ; ไม่เก็บใน repository
- **ตรวจ log**: หลีกเลี่ยงการ echo ค่าจาก Secrets Manager/SSM ที่เป็นความลับ
- **Credential chain**: `deploy.sh` ใช้ AWS credential ปกติ (profile, environment,
  CloudShell หรือ EC2 instance profile) จึงใช้ `LabInstanceProfile` บน runner ได้
  โดยไม่ต้องตั้ง access key

## ผลที่ตามมา

### ข้อดี

- ไม่ต้องสร้าง IAM OIDC provider หรือ IAM user ซึ่งเป็นข้อจำกัดที่ผ่านไม่ได้ใน Lab
- ใช้ `deploy.sh` และ SSM Run Command ที่มีอยู่ ไม่ต้อง rewrite เป็น CodeDeploy/ECS
- ไม่มี AWS key ระยะยาวใน GitHub
- backend deploy ยังคง health check และมีหลักฐานจาก SSM

### ข้อเสีย

- ต้องมี runner EC2 ที่เปิดอยู่และดูแล patch/เครื่องเอง
- สิทธิ์ของ runner คือ `LabRole` ทั้งก้อน ไม่ใช่ least privilege
- workflow deploy backend ยังไม่ถูกเพิ่มใน V5; ต้องตั้ง runner และเพิ่ม workflow ก่อนใช้จริง
- rollback อัตโนมัติยังไม่ implement
- Learner Lab หยุด EC2 เมื่อ session หมดอายุ ทำให้ workflow ที่ต้องใช้ runner หรือ backend จะไม่ทำงาน

## เกณฑ์ทบทวน

ทบทวนเมื่อ:

1. บัญชีปกติที่สร้าง IAM role/OIDC provider ได้ พร้อมใช้ GitHub OIDC
2. ต้อง deploy หลาย environment หรือหลาย repo พร้อมกัน
3. ต้องการ rollback อัตโนมัติและ audit level production
4. ค่าใช้จ่ายของ runner EC2 เกินประโยชน์เทียบกับ deploy manual

## เอกสารที่เกี่ยวข้อง

- [ขอบเขต Learner Lab V5](v5-learner-lab-scope.md)
- [เครื่องมือ IaC V5](v5-iac-tooling.md)
- [สถาปัตยกรรม V5](../architecture/v5-architecture.md)
- [คู่มือ deploy V5](../runbooks/v5-deploy.md)
- [บันทึก Amplify spike](../notes/v5-amplify-spike.md)
