# เทคโนโลยีและการตัดสินใจของ V1

## ชุดเทคโนโลยี

| ชั้น | ตัวเลือก | เวอร์ชัน / รูปแบบ | เหตุผล |
|---|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | Next 16.3.4, React 18 | รักษาโครงสร้างหน้าเดิม, build แบบ type-safe และสร้าง standalone image ได้ โดย Next 16.3.4 แก้ high-severity advisories ที่ npm รายงาน ณ วันที่ตรวจ |
| Styling | Tailwind CSS | 3.x | ใช้ UI เดิมต่อได้โดยไม่ต้องเปลี่ยน component library |
| API | FastAPI, Pydantic v2 | Python 3.11+ | มี OpenAPI แบบ versioned, database dependency และ DTO aliases ชัดเจน |
| ORM | SQLAlchemy | 2.x | ประกาศ relationships, constraints และ indexes ร่วมกันระหว่าง runtime, seed และ tests |
| ฐานข้อมูล | PostgreSQL | 16.x | ใช้ major เดียวกันใน Compose และ CI และรองรับโมเดลสถานะเผยแพร่ |
| Storage | local volume หรือ AWS S3 | เลือกด้วย environment | local/CI ไม่ต้องมี cloud credential ส่วน production แยก bytes ออกจากฐานข้อมูล |
| Verification | pytest, Docker Compose smoke, Next build | backend 31 tests และ full-stack smoke | ครอบคลุม contract, publication filtering, schema/seed และเส้นทาง runtime ที่รองรับ |

## การตัดสินใจและทางเลือกที่ไม่เลือก

### Public route โหลดจาก API แบบ strict

public dashboard และหน้า partner/activity list/detail ใช้ strict loader พร้อม
สถานะ loading, empty, error และ retry

- เลือกเพื่อให้ผู้ใช้แยกข้อมูลจริงที่เผยแพร่แล้วออกจากคำขอที่ล้มเหลวได้
- ไม่เลือก silent mock fallback สำหรับ public route เพราะซ่อน outage และไม่ใช่
  หลักฐานการทำงานจาก backend ถึง database
- หน้าต้นแบบตาม role ที่ยังอยู่นอกผลลัพธ์ V1 อาจคง fallback ไว้ชั่วคราว

### บังคับสถานะเผยแพร่ที่ API

FastAPI กรอง `is_published` ทั้ง list/detail และไม่ส่ง draft partner ที่ซ้อนใน
published activity โดย ID ที่ไม่มีและ draft ใช้ 404 body เดียวกัน

- เลือกเพื่อให้ทุก client ได้การป้องกันเดียวกัน
- ไม่เลือกการซ่อนเฉพาะใน UI เพราะผู้เรียก API โดยตรงข้ามเมนูได้

### Compose ครบทั้งระบบ

Compose มี PostgreSQL, seed แบบ one-shot/idempotent, FastAPI และ Next.js พร้อม
health-based dependencies

- เลือกเพื่อให้ clean checkout เริ่มระบบได้ด้วยคำสั่งตามเอกสารเพียงชุดเดียว
- ไม่เลือกพึ่ง PostgreSQL อื่นบน host เพราะ schema, credential และ readiness
  ทำซ้ำไม่ได้
- credential เริ่มต้นใช้เฉพาะ development, bind ฐานข้อมูลที่ loopback และไม่ commit
  production secret

### Schema V1 แบบ additive พร้อม integrity

SQLAlchemy คง field ที่เข้ากันได้และ nullable พร้อมเพิ่ม natural-key uniqueness,
domain checks, indexes และ foreign-key delete behavior โดย `create_all` และ seed
ที่ idempotent รองรับ clean V1 environment

- เลือกเพื่อรักษารูปข้อมูลเดิมพร้อมทำให้ environment ใหม่แน่นอน
- ไม่เลือก clean-schema rewrite ที่ทำลาย compatibility ใน V1 ส่วน production
  migration แบบ versioned เป็นงานหลัง V1

### Tests แยกจากข้อมูลจริง

API tests override database dependency ด้วย in-memory SQLite ใหม่ผ่าน
`StaticPool` และ schema/seed checks ใช้ฐานชั่วคราวแยก

- เลือกเพื่อตัด state ที่ขึ้นกับลำดับและเครื่องนักพัฒนา
- ไม่เลือกใช้ application database ร่วม เพราะข้อมูลอาจรั่วระหว่าง tests หรือแตะ
  ข้อมูลของผู้พัฒนา

### Storage abstraction

ฐานข้อมูลเก็บ document metadata และ storage key ส่วน bytes อยู่ใน local volume
หรือ S3

- เลือกเพื่อให้ local/CI เป็น hermetic และ production scale ได้
- ไม่เลือกเก็บ binary ขนาดใหญ่ใน PostgreSQL เพราะทำให้ backup โตและผูก file
  delivery กับ relational query

ดู [สถาปัตยกรรม V1](../architecture/v1-architecture-th.md) และ
[ดัชนีหลักฐาน](../evidence/v1-readiness.md)
