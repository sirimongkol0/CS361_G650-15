# ขอบเขต Learner Lab สำหรับ V5

> ตรวจเมื่อ: 8 พฤศจิกายน 2026 · บัญชี `073362813452` · role `voclabs`
> เอกสารนี้บันทึกข้อจำกัดที่ **ตรวจแล้ว** และสิ่งที่ V5 ทำได้/ไม่ได้ในบัญชีนี้
> ผลการทดสอบจริงของแต่ละข้ออยู่ใน [แผนทดสอบ V5](../evidence/v5-validation.md)

## ทำไมต้องมีเอกสารนี้

V5 ตั้งใจให้สร้าง infrastructure ซ้ำได้ด้วย IaC แต่ Learner Lab ไม่ใช่บัญชี AWS ปกติ
บริการบางอย่างสร้างได้ บางอย่างถูกปฏิเสธ และ session มีอายุจำกัด
ถ้าไม่แยกให้ชัดว่า “อะไรอยู่ในขอบเขต” การออกแบบจะหลุดไปใช้บริการที่ Lab ไม่รองรับ
และจะพบความล้มเหลวตอน deploy แทนที่จะพบตอน review

เอกสารนี้เป็นสัญญาระหว่างผู้ออกแบบ template กับผู้รัน Lab:

- สิ่งที่อยู่ในขอบเขตต้องมีคำสั่งตรวจและหลักฐานใน [v5-validation.md](../evidence/v5-validation.md)
- สิ่งที่อยู่นอกขอบเขตต้องไม่ถูกใส่ใน template หรือต้องมีเงื่อนไขข้าม
- สิ่งที่ยังไม่ยืนยันต้องไม่ถูกกล่าวอ้างว่าผ่าน

## ข้อจำกัดที่ตรวจแล้ว

| ข้อจำกัด | ผลที่ตรวจ | ผลต่อ V5 |
|---|---|---|
| Region | ใช้ได้เฉพาะ `us-east-1` และ `us-west-2`; region อื่นถูกปฏิเสธ | ใช้ `us-west-2` เป็นค่า Lab; ห้าม hard-code Sydney ใน Lab |
| IAM user/group/role/policy | สร้างไม่ได้ | `LabMode=true` ต้องไม่สร้าง `AppRole`, `AppInstanceProfile`, `BackupSchedulerRole` |
| IAM ที่มีอยู่ | `LabRole` และ `LabInstanceProfile` ถูกสร้างไว้ล่วงหน้า | ใช้ `LabInstanceProfile` กับ EC2 และใช้ ARN ของ `LabRole` เป็น scheduler role |
| Service-linked role | สร้างได้เฉพาะ service-linked role | ไม่ใช้เป็นเหตุผลให้สร้าง role ทั่วไป |
| GitHub OIDC | `iam:CreateOpenIDConnectProvider` ถูกปฏิเสธ | V5-5 (#122) ปิดเป็น not planned; ใช้ self-hosted runner แทน |
| Cognito | สร้าง user pool/client/group ได้ | `cognito.yaml` อยู่ในขอบเขต |
| CloudFormation | สร้าง/อัปเดต stack และ drift detection ได้ | ใช้เป็นเครื่องมือ IaC หลัก |
| SSM Parameter Store | ใช้ได้ รวมถึง `SecureString` | เก็บ config ที่ไม่ใช่ secret และใช้เป็น interface ระหว่าง stack |
| Secrets Manager | ใช้ได้ | เก็บรหัสผ่านฐานข้อมูลเป็น JSON secret |
| SNS | ใช้ได้ | topic สำหรับแจ้งเตือน backup |
| EventBridge Scheduler | ใช้ได้; schedule `cs361-backup` เป็น ENABLED และรันสำเร็จ | schedule สำหรับ backup (ยืนยันกับ `LabRole` แล้ว) |
| EC2 | ใช้ได้ (รวม stop/start) | backend, PostgreSQL และ fallback frontend |
| Amplify CreateApp/CreateBranch | ใช้ได้ | สร้าง app/branch ผ่าน stack ได้ |
| Amplify build Next.js SSR | **ยังไม่ยืนยัน**; Amplify ไม่อยู่ใน supported services list | ต้องมี EC2/Docker fallback; ห้ามถือว่า build ผ่านจนมีหลักฐาน |
| อายุ credentials | หมดอายุเมื่อจบ session | ต้องรัน `check` ใหม่ทุก session และไม่เก็บ key ลงเครื่อง |
| สถานะ EC2 | ถูกหยุดเมื่อ session จบ | scheduled backup/งานประจำไม่ทำงานขณะ Lab ไม่ active |

### คำสั่งตรวจข้อจำกัด (ทำซ้ำได้)

```bash
aws sts get-caller-identity
aws ec2 describe-vpcs --region us-west-2 --max-items 1
aws ec2 describe-vpcs --region ap-southeast-2 --max-items 1   # คาดว่าจะถูกปฏิเสธ
aws iam get-role --role-name LabRole
aws iam get-instance-profile --instance-profile-name LabInstanceProfile
aws iam list-open-id-connect-providers
```

> คำสั่งที่คาดว่าจะถูกปฏิเสธใช้เพื่อยืนยันขอบเขตเท่านั้น อย่าพยายามสร้าง resource
> เพื่อ "ลองดู" ซ้ำ เพราะอาจทิ้ง resource ค้างหรือทำให้ session มีปัญหา

## สิ่งที่อยู่ในขอบเขต V5

- CloudFormation template 4 ชุด: `stack.yaml`, `cognito.yaml`, `amplify.yaml`, `backup.yaml`
- `deploy.sh` ที่สั่งงานแบบ plan/apply และจัดการ stack ตามลำดับ
- Cognito user pool `cstu-v5-auth`, app client `cstu-backend` และกลุ่มบทบาท 5 กลุ่ม
- SSM parameter ใต้ `/cs361/config/*` และ Secrets Manager secret สำหรับรหัสผ่านฐานข้อมูล
- Amplify app/branch เมื่อมี GitHub token; fallback frontend บน EC2 เมื่อไม่มี
- Backup อัตโนมัติผ่าน EventBridge Scheduler → SSM Run Command → S3
- SNS แจ้งเตือน และ CloudWatch alarm เมื่อ backup ไม่สำเร็จ
- CI ตรวจ template ด้วย `cfn-lint`/`cfn-guard` และตรวจ drift
- Teardown แบบเก็บ S3/Cognito (`--yes`) และแบบลบทั้งหมด (`--yes --purge`)
- เอกสาร baseline, validation, architecture และ runbook

## สิ่งที่อยู่นอกขอบเขต V5

- การสร้าง IAM user/group/role/policy หรือ OIDC provider ใน Learner Lab
- การรับประกันว่า Amplify build Next.js 16 SSR จะสำเร็จใน Lab
- custom domain, HTTPS ระหว่าง Amplify กับ EC2, load balancer, Auto Scaling, Multi-AZ
- backup ข้าม region, point-in-time recovery, RDS snapshot
- การหมุน secret อัตโนมัติ (V5 ทำ manual ผ่าน Secrets Manager + `deploy.sh backend`)
- การรัน scheduled job ขณะ Lab session ปิด
- production SLA, load test, penetration test
- การ migrate ข้อมูลจาก user pool/stack V4 เดิมโดยอัตโนมัติ

## ขอบเขตตาม issue #118–#125

| Issue | อยู่ในขอบเขต | อยู่นอกขอบเขต | สถานะ / สิ่งที่เปลี่ยน |
|---|---|---|---|
| **#118 V5-1** ขอบเขต, ADR, baseline | ADR เลือก CloudFormation, ADR ช่องทาง deploy backend, ขอบเขต Lab, baseline ก่อน–หลัง, architecture, validation, runbook | การแก้ template หรือ code | เอกสารชุดนี้; baseline มีผล Lab บางส่วนและ TBD สำหรับเวลาที่ไม่ได้จับ |
| **#119 V5-2** Cognito as IaC | `cognito.yaml`: pool, client, กลุ่ม `public/student/coordinator/staff/admin`, SSM parameter, outputs; `provision_cognito.py --pool-id` สำหรับผู้ใช้ทดสอบ | สร้าง IAM role, custom domain, social IdP, MFA policy ใหม่, migration pool เดิม | ผ่านใน Lab (`cs361-cognito` CREATE_COMPLETE, pool `cstu-v5-auth`) |
| **#120 V5-3** Amplify + CORS as IaC | `amplify.yaml`: app `WEB_COMPUTE`, branch `main`, env vars, SSM `amplify_url`, outputs; fallback `deploy.sh frontend --apply` บน EC2 :3000; CORS จาก SSM/output | รับประกันว่า Amplify build ผ่าน, จัดการ GitHub token แทนผู้ใช้, สร้าง IAM service role ใน Lab | fallback + CORS ผ่าน; Amplify stack/build N/A เพราะไม่มี token (API probe สร้าง app/branch ได้) |
| **#121 V5-4** SSM/Secrets | SSM parameter 6 ตัวใน base stack, Cognito 2 ตัว, Amplify 1 ตัว; Secrets Manager secret JSON `{username, dbname, password}`; `deploy.sh backend` อ่าน secret ไปสร้าง `.env` | rotation อัตโนมัติ, cross-account secret, CMK ที่จัดการเอง | ยุบเข้า base stack (`stack.yaml`); ผ่านใน Lab (parameter/secret/health) |
| **#122 V5-5** GitHub OIDC | ไม่มี; บันทึกเหตุผลและทางเลือกใน [v5-backend-deploy.md](v5-backend-deploy.md) | OIDC provider, IAM role สำหรับ GitHub, access key ระยะยาว | **ปิดเป็น not planned** เพราะ Lab ปฏิเสธ `CreateOpenIDConnectProvider`; ใช้ self-hosted runner + SSM เป็นแนวทางแทน |
| **#123 V5-6** Backup/restore/alerts | `backup.yaml`: SNS topic, SSM document, EventBridge Scheduler, CloudWatch alarm; `backup.sh`; `deploy.sh backup/restore` | PITR, cross-region copy, RDS snapshot, รับประกันขณะ Lab ปิด | ผ่าน: schedule รันจริง, backup/restore สำเร็จ, failure alert เป็น ALARM |
| **#124 V5-7** CI + drift | `.github/workflows/infra.yml` ตรวจ `cfn-lint`/`cfn-guard`; drift detection ด้วย CloudFormation | auto-remediation, runtime compliance, security scanning ทั้งระบบ | lint/guard ผ่านในเครื่อง; drift ตรวจพบ `MODIFIED`; GitHub Actions ยังไม่รันเพราะไม่ push; IN_SYNC รอ session ถัดไป |
| **#125 V5-8** Evidence/docs | before/after, validation matrix, architecture, runbook, หลักฐานจาก Lab | load test, production readiness, SLA | deploy/backup/restore/alert ผ่าน; teardown + recreate จากศูนย์ยัง TBD |

## สรุปสิ่งที่ปิดหรือเปลี่ยนจากแผนเดิม

1. **#122 V5-5 ปิดเป็น not planned** — GitHub OIDC เป็นไปไม่ได้ในบัญชีนี้
   ไม่มี OIDC provider และไม่มี IAM role สำหรับ GitHub ใน V5
2. **#120 V5-3 เปลี่ยนขอบเขต** — จาก “Amplify เป็น frontend หลัก” เป็น
   “Amplify ถ้าสร้างและ build ได้ + EC2 fallback ที่ใช้ได้จริง”
   เพราะ Amplify ไม่อยู่ใน supported list และ build SSR ยังไม่ยืนยัน
3. **#121 V5-4 ยุบเข้า base stack** — ไม่มี stack `cs361-config` แยก
   SSM parameter และ secret ถูกสร้างใน `stack.yaml` เพื่อลดจำนวน stack และ dependency
4. **#118/#125 ขยายเอกสาร** — เพิ่ม baseline, validation matrix และ runbook
   เพื่อให้ตัวเลขก่อน–หลังและขั้นตอน Lab ตรวจซ้ำได้

## ผลต่อการออกแบบ

- ทุก stack ต้องรับ `ConfigPrefix` และ `ProjectName` เพื่อให้ใช้ชื่อเดียวกันทั้งชุด
- base stack ต้องมี `LabMode` และเงื่อนไข IAM; ค่าเริ่มต้นคือ `false` สำหรับบัญชีปกติ
- `deploy.sh` ต้องตรวจ `voclabs` หรือ `LAB_MODE=true` และตั้ง region `us-west-2`
- ห้ามใช้ `AWS::IAM::Role` ใน Lab แม้จะเป็น role เล็ก ๆ; ใช้ `LabRole`/`LabInstanceProfile`
- Amplify ต้องมีเงื่อนไข `HasToken`; ถ้าไม่มี token ต้องไม่สร้าง resource และไป fallback
- backup ต้องไม่ถือว่า schedule ทำงานแน่นอน; ต้องมี `deploy.sh backup` สำหรับ manual
- CI ต้องไม่พึ่ง service ที่ Lab ไม่รองรับ; ใช้ static lint เป็นหลัก

## ความเสี่ยง

| ความเสี่ยง | ผลกระทบ | การรับมือ |
|---|---|---|
| Lab เปลี่ยน supported services โดยไม่แจ้ง | Amplify/SSM/Scheduler อาจใช้ไม่ได้ | fallback frontend; เก็บ backup แบบ manual; ตรวจ `check` ทุก session |
| Session หมดอายุระหว่าง deploy | stack ค้างสถานะกลางทาง | รัน `check` ก่อน, ทำทีละ stack, เก็บ log; ใช้ `continue-update-rollback` หรือ deploy ซ้ำ |
| `LabRole` กว้างเกินไป | runner/เครื่อง EC2 มีสิทธิ์มาก | จำกัด repo/branch, ไม่รัน PR จาก fork, ไม่ทำ production |
| `LabRole` ไม่มีสิทธิ์ที่ต้องการบางอย่าง | คำสั่งบางขั้นอาจถูกปฏิเสธ | ตรวจด้วย `deploy.sh check` และบันทึกข้อจำกัด; V5 ใช้ backup manual ได้ |
| ไม่มี IAM role สำหรับ Amplify | build ไม่ผ่าน | ใช้ fallback และบันทึกว่า build ยังไม่ยืนยัน |
| ค่าใช้จ่ายเมื่อเปิด runner ตลอด | เกินเครดิต | หยุด runner เมื่อไม่ใช้; ใช้ `deploy.sh backend` จาก CloudShell แทน |
| เวลาบางช่วงยังไม่ได้จับ | before/after ไม่ครบทุกตัวเลข | ใช้ TBD พร้อมหมายเหตุและวิธีวัดใน [v5-baseline.md](../evidence/v5-baseline.md) |

## เอกสารที่เกี่ยวข้อง

- [เครื่องมือ IaC V5](v5-iac-tooling.md)
- [ช่องทาง deploy backend V5](v5-backend-deploy.md)
- [สถาปัตยกรรม V5](../architecture/v5-architecture.md)
- [Baseline V5](../evidence/v5-baseline.md)
- [แผนทดสอบ V5](../evidence/v5-validation.md)
- [คู่มือ deploy V5](../runbooks/v5-deploy.md)
