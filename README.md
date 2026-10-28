# Dream Valley — บ้านดงเย็น

เกมชีวิตชนบทไทยแนว Stardew Valley มุมมอง Isometric · กลับมาดูแลบ้านยายที่ตำบลบ้านดงเย็น
เล่นบนมือถือได้ ติดตั้งเป็นแอป (PWA) ได้ ไม่ต้องติดตั้งอะไรเพิ่ม (JavaScript ล้วน)

## เปิดเล่น / ขึ้น GitHub Pages
1. สร้าง repo ใหม่บน GitHub แล้ว push โฟลเดอร์นี้ขึ้นไป (ดูคำสั่งด้านล่าง)
2. GitHub → Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `(root)` → Save
3. รอ 1–2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/dream-valley/`
4. เปิดลิงก์ในมือถือ → เมนูของเบราว์เซอร์ → "เพิ่มลงในหน้าจอหลัก / ติดตั้งแอป"

```bash
git remote add origin https://github.com/<ชื่อผู้ใช้>/dream-valley.git
git push -u origin main
```

## ความต่างระหว่างเวอร์ชัน GitHub กับลิงก์ใน Claude
| | ลิงก์ Artifact ใน Claude | GitHub Pages |
|---|---|---|
| เซฟ | เครื่อง + คลาวด์ของบัญชี | ในเครื่อง (เบราว์เซอร์) เท่านั้น |
| โทรเล่นกับเพื่อน (แอปโทรศัพท์ในเกม) | ได้ (ต้องล็อกอิน Claude) | ยังไม่ได้ — ต้องต่อเซิร์ฟเวอร์ เช่น Firebase ภายหลัง |
| ติดตั้งเป็นแอป / เล่นออฟไลน์ | — | ได้ (manifest + `sw.js`) |

## โครงสร้าง
- `index.html` `style.css` `ui_icons.css` — หน้าเกม
- `js/` — core (เซฟ เงื่อนไข) · world (แผนที่ Isometric กล้อง ซูม/เลื่อน โหมดจัดฟาร์ม) · farm · people (NPC บทคุย ร้าน งาน) · story (ฉาก การ์ด หวย LINE) · line (แอป LINE) · net (โทรศัพท์/เล่นหลายคน) · audio (เพลง เสียงเดิน) · ui · main
- `data/*.js` — **สร้างอัตโนมัติ** จาก `content/` ด้วย `tools/compile_data.py` ห้ามแก้มือ
- `content/` — บททั้งหมด (YAML): `dialogue/` บทคุย+งานของ 33 คน · `dialogue_f/` บทเฉพาะผู้เล่นหญิง · `story/` เนื้อเรื่องหลัก LINE กลุ่ม เสียงรอบตัว ตุ๊กแก
- `tools/` — สคริปต์สร้างแผนที่/ตัวละคร/ไอคอน และ `make_sw.py` (รันทุกครั้งก่อน push เพื่ออัปเดตแคชออฟไลน์)

## แก้บทแล้วสร้างข้อมูลใหม่
```bash
pip install pyyaml pillow numpy scipy
python tools/compile_data.py content .     # content/ ต้องมี dialogue/ dialogue_f/ story/ ref/
python tools/make_sw.py .
```
