# Usability test kit — PCSMS

ชุดเอกสารสำหรับการทดสอบกับผู้ใช้จริงอย่างน้อย 3 คน จากอย่างน้อย 2 roles ตามใบโจทย์

> **สถานะ:** เตรียมแผนและเครื่องมือแล้ว ยังไม่ได้ทดสอบกับผู้ใช้จริง  
> ต้องเติม TC1/TC2 จากใบโจทย์ของอาจารย์ และบันทึกผลจริง

## ไฟล์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `flow-audit.md` | ผล pre-audit ความซับซ้อนของ flow ก่อนทดสอบจริง |
| `test-plan.md` | แผนทดสอบ, roles, กำหนดการ, ตัวชี้วัด |
| `task-cards-th.md` | การ์ดสถานการณ์ TC1/TC2 (อ่านให้ผู้ใช้ฟัง) |
| `observation-sheet.csv` | ตารางบันทึกผลรายคน/ราย task |
| `consent-th.md` | ใบยินยอม |
| `findings-template.md` | template สรุปรายงาน |

## ลำดับที่แนะนำ

1. ยืนยัน TC1/TC2 จากใบโจทย์
2. เตรียมผู้เข้าร่วม 2 roles (แนะนำ 2 students + 2 staff/coordinator)
3. Reset ข้อมูล demo และทดสอบนำร่อง 1 คน
4. ทดสอบจริง ทีละคน คนละ 45–60 นาที
5. สรุปผลใน `findings-template.md` และแนบหลักฐาน

## กติกาหลัก

- ผู้ใช้ทำเอง ผู้ดูแลไม่บอกขั้นตอนหรือชี้ปุ่ม
- บันทึกว่าสำเร็จเอง/ต้องช่วย/ไม่สำเร็จ
- เก็บทั้งเวลา จำนวนครั้งที่ผิด และคำพูด
- ใช้ข้อมูลสมมติเท่านั้น

## Environment

- Lab: `https://equal-preceding-hugo-treasures.trycloudflare.com`
- Accounts: student / staff / coordinator / admin (ดูรหัสผ่านจากผู้ดูแล)
- ถ้า lab reset ระหว่างทดสอบ ให้ใช้ local Docker หรือ environment สำรอง
