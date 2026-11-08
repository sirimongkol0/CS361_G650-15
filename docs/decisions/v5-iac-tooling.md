# การตัดสินใจ: เครื่องมือ IaC สำหรับ V5

> สถานะ: ตกลง · วันที่: 8 พฤศจิกายน 2026 · เกี่ยวข้อง: #118 (V5-1), #124 (V5-7)
> ขอบเขต: V5 — สร้างและปรับใช้ infrastructure/deployment ซ้ำด้วย automation หรือ IaC

## บริบท

V4 สร้าง infrastructure หลักด้วย CloudFormation ไฟล์เดียว (`infra/new-account/stack.yaml`)
และใช้ `infra/new-account/deploy.sh` เป็นตัวสั่งงานจาก CloudShell
แต่ยังมีขั้นที่ต้องทำเองใน Console (สร้าง Amplify app, ใส่ environment variables)
และการ deploy backend ยังต้องสั่งด้วยมือทุกครั้ง

V5 ต้องทำให้ทั้งระบบสร้างซ้ำได้จาก repository โดยมีเงื่อนไขเพิ่มเติมจาก Learner Lab:

- สร้าง IAM user/group/role/policy ไม่ได้ ต้องใช้ `LabRole` และ `LabInstanceProfile` ที่มีอยู่
- ใช้ได้เฉพาะ region `us-east-1` และ `us-west-2`
- CloudFormation ใช้ได้ รวมถึง drift detection (ตรวจแล้วใน Learner Lab)
- ต้องตรวจ template ได้ใน CI และมี change set ให้รีวิวก่อน apply

## การตัดสินใจ

เลือก **AWS CloudFormation (YAML)** เป็นเครื่องมือ IaC หลักของ V5

- แยก stack ตามอายุการเปลี่ยนแปลง: `cs361` (base), `cs361-cognito`, `cs361-amplify`, `cs361-backup`
- ทุก stack อยู่ใน `infra/new-account/` และ deploy ผ่าน `deploy.sh` ที่ห่อ `aws cloudformation deploy`
- ก่อน apply ให้สร้าง change set ด้วย `--no-execute-changeset` แล้วแสดง `Changes[]` ให้ตรวจ
- ใช้ output ของ stack เป็น interface ระหว่าง stack แทนการอ่านค่าจาก Console
- ใช้ `cfn-lint` และ `cfn-guard` ตรวจ template ใน CI (`.github/workflows/infra.yml`)
- ใช้ drift detection ของ CloudFormation เป็นจุดตรวจว่า resource จริงยังตรงกับ template

CloudFormation เป็นตัวจัดการ state ให้ในบริการเอง ไม่มีไฟล์ state ใน repository
และไม่ต้อง bootstrap backend สำหรับ state ก่อนใช้งาน

## เหตุผล

### 1. State และภาระปฏิบัติการ

| ประเด็น | CloudFormation | CDK | Terraform |
|---|---|---|---|
| ที่เก็บ state | AWS จัดการให้ | CloudFormation (ผ่าน synthesized template) | ต้องมี state backend เช่น S3 + DynamoDB |
| ล็อก state | ไม่ต้องตั้ง | ไม่ต้องตั้ง | ต้องตั้ง locking เพิ่ม |
| State drift จาก session ที่หมดอายุ | ตรวจด้วย drift detection | ตรวจผ่าน CloudFormation | ต้อง reconcile state เอง |
| งานก่อน deploy ครั้งแรก | ไม่มี | ต้อง `cdk bootstrap` | ต้องสร้าง backend และติดตั้ง provider |

Learner Lab ปิด session แล้ว credentials หมดอายุและ EC2 ถูกหยุด
การมี state ที่อยู่นอก AWS ทำให้ต้องกู้ state ก่อนทำงานทุกครั้ง ซึ่งเพิ่มจุดล้มเหลวโดยไม่จำเป็น
CloudFormation เก็บสถานะของ stack ไว้ใน AWS และถามกลับได้เสมอด้วย `describe-stacks`

### 2. ความคุ้นเคยของทีมและโค้ดที่มีอยู่

- V4 ใช้ `stack.yaml` อยู่แล้ว การต่อยอดเป็น stack ย่อยเป็นการเพิ่มไฟล์ ไม่ใช่การเขียนใหม่
- ทีมอ่าน YAML และคำสั่ง `aws cloudformation` ได้อยู่แล้ว และใช้ CloudShell เป็นหลัก
- ไม่ต้องเพิ่ม Node.js/npm (CDK) หรือ binary/provider cache (Terraform) ในเครื่องที่ deploy
- `deploy.sh` ที่มีอยู่ห่อ CloudFormation อยู่แล้ว จึงรักษารูปแบบคำสั่งเดิมได้

### 3. CloudShell

CloudShell มี AWS CLI และ credential ของบัญชีอยู่แล้ว
คำสั่ง `aws cloudformation deploy`, `describe-change-set` และ `detect-stack-drift` ใช้ได้ทันที
ส่วน CDK ต้องติดตั้ง toolchain และ `cdk bootstrap` ซึ่งสร้าง IAM role และ S3 bucket เพิ่ม
ใน Learner Lab การสร้าง IAM role ถูกปฏิเสธ จึงเป็นอุปสรรคตั้งแต่ขั้นแรก
Terraform ต้องเตรียม binary และ state backend เอง ซึ่งเพิ่มขั้นตอนติดตั้งใน CloudShell

### 4. ค่าใช้จ่าย

- CloudFormation ไม่คิดค่าใช้จ่ายตามจำนวน stack หรือ API call
- CDK ไม่คิดค่าใช้จ่ายตัว tool แต่ bootstrap อาจมี S3 bucket และ IAM role ที่ต้องดูแล
- Terraform open source ไม่มีค่าลิขสิทธิ์ แต่มีค่า S3/DynamoDB สำหรับ state และเวลาดูแล state
- ค่าใช้จ่ายจริงของ V5 มาจาก EC2, EBS, Elastic IP, S3, Secrets Manager และ SNS/Scheduler ไม่ใช่เครื่องมือ IaC

### 5. Review และ change set

CloudFormation ให้ change set ที่บอก action, resource type, logical ID และ replacement
ก่อน apply ทุกครั้ง ซึ่งตรงกับข้อกำหนดของ V5 ที่ต้องมีขั้นตรวจก่อนเปลี่ยน infrastructure
นอกจากนี้ยังใช้ `cfn-lint`/`cfn-guard` ตรวจ syntax และกฎความปลอดภัยใน CI ได้
ส่วน drift detection ใช้ตรวจว่า resource ที่ถูกแก้จาก Console ยังตรงกับ template หรือไม่

### 6. Infrastructure ที่มีอยู่

`infra/new-account/stack.yaml` เป็น CloudFormation อยู่แล้ว
การย้ายไป CDK/Terraform จะต้องแปลง resource เดิมทั้งหมดและเสี่ยงทำให้ VPC/EC2/S3 ถูกสร้างใหม่
ซึ่งมีผลกับ Elastic IP, ข้อมูลใน EBS และ URL ที่ Amplify ใช้
การคง CloudFormation จึงเป็นการเปลี่ยนแปลงที่เล็กที่สุด

## ทางเลือกที่พิจารณา

| ทางเลือก | ข้อดี | ข้อเสีย | สรุป |
|---|---|---|---|
| **CloudFormation YAML** | state อยู่ใน AWS, ใช้ใน CloudShell ได้ทันที, ต่อยอดไฟล์เดิม, change set/drift ครบ | YAML ยาว, reuse ได้จำกัด, resource coverage ตาม AWS | **เลือก** |
| AWS CDK | ใช้ภาษาโปรแกรม test/refactor ได้, construct reuse | ต้อง bootstrap (IAM role/S3), เพิ่ม toolchain, ทีมยังไม่ใช้, แปลง stack เดิมทั้งไฟล์ | ไม่เลือกใน V5 |
| Terraform | หลาย cloud, module ecosystem, plan ชัด | ต้องจัดการ state/lock, ติดตั้ง binary/provider เอง, แปลงไฟล์เดิม | ไม่เลือกใน V5 |
| สคริปต์ AWS CLI ตรง ๆ | ควบคุมได้ทุกคำสั่ง | ไม่มี state, ไม่มี change set, ยากต่อการตรวจ drift, เรียงลำดับเองทั้งหมด | ใช้เป็นตัวสั่งงาน ไม่ใช่ IaC |
| ไม่ทำ IaC | เร็วที่สุดในระยะสั้น | สร้างซ้ำไม่ได้, พลาดง่าย, ไม่มีหลักฐานก่อน–หลัง | ขัดกับเป้าหมาย V5 |

## ผลที่ตามมา

### ข้อดี

- สร้าง stack ใหม่จาก repository ได้ โดยไม่ต้องจำค่าที่ Console
- change set ทำให้เห็นผลก่อนเปลี่ยน และใช้ review ใน CI/PR ได้
- drift detection ตรวจการแก้ไข manual ที่หลุดจาก template
- ใช้ `LabMode` เพื่อข้าม resource ที่ Lab สร้างไม่ได้ โดยไม่ต้องมี template คนละชุด
- ค่าใช้จ่ายของเครื่องมือเป็นศูนย์

### ข้อเสียและการลดผลกระทบ

| ข้อเสีย | การลดผลกระทบ |
|---|---|
| YAML ยาวและไม่มี type checking | ใช้ `cfn-lint` + `cfn-guard` ใน CI และ `validate-template` ก่อน deploy |
| reuse ข้าม stack ทำได้จำกัด | ใช้ output/parameter เป็น interface ที่ชัดเจน และแยก stack ตามขอบเขต |
| CloudFormation สร้าง resource บางอย่างช้ากว่าหรือไม่รองรับ | ตรวจ template ใน CI และมี fallback สำหรับ Amplify |
| drift detection ต้องสั่งเอง | เพิ่มขั้นใน CI หรือ runbook ตามรอบ |
| การเปลี่ยนแปลง resource บางชนิดทำให้ถูก replace | ดู `Replacement` ใน change set ก่อน apply และ backup ก่อนเปลี่ยน stack |

## ความเสี่ยงที่ยังเปิดอยู่

- **IAM ใน Learner Lab**: template ต้องมีเงื่อนไข `LabMode` เพื่อไม่สร้าง `AppRole`,
  `AppInstanceProfile` และ `BackupSchedulerRole` มิฉะนั้น stack จะล้มเหลว
- **CloudFormation resource coverage**: บริการที่ Lab อนุญาตอาจไม่ครบทุก property
  โดยเฉพาะ Amplify ที่อยู่นอก supported list; ต้องมี fallback
- **State ไม่ได้อยู่ใน Git**: ผู้ดูแลต้องใช้ stack name/region ให้ตรงกันทุกครั้ง
  เอกสารและ `deploy.sh` จึงกำหนด `STACK`, `AWS_REGION` และ `CONFIG_PREFIX` เป็นค่ากลาง
- **Terraform/CDK ในอนาคต**: ถ้ามีหลาย environment หรือหลาย cloud ค่อยประเมินใหม่
  โดยไม่ต้องรื้อ stack ที่ใช้งานอยู่

## เกณฑ์ทบทวน

ทบทวนการตัดสินใจนี้เมื่อเกิดข้อใดข้อหนึ่ง:

1. ต้อง deploy มากกว่าหนึ่ง environment พร้อมกันและต้องการ state/lock ที่แยกกัน
2. CloudFormation ไม่รองรับ resource ที่จำเป็นและไม่มีทางเลี่ยง
3. ทีมต้องการ test infrastructure ด้วยภาษาโปรแกรมจนคุ้มค่ากับ bootstrap
4. ต้องรองรับหลาย cloud

## เอกสารที่เกี่ยวข้อง

- [สถาปัตยกรรม V5](../architecture/v5-architecture.md)
- [การ deploy backend V5](v5-backend-deploy.md)
- [ขอบเขต Learner Lab V5](v5-learner-lab-scope.md)
- [คู่มือ deploy V5](../runbooks/v5-deploy.md)
