# Markdown Widgets for Obsidian

ปลั๊กอินสำหรับเพิ่ม widget ที่อัปเดตสดลงใน Markdown โดยเริ่มจาก `countdown`
และวางโครงให้เพิ่ม widget ชนิดใหม่ภายหลังได้โดยไม่ต้องแก้ระบบเดิมทั้งหมด

## Inline countdown placeholder

พิมพ์ placeholder ไว้ตรงไหนของประโยคก็ได้:

```md
ส่งงานในอีก %{count: 2026-12-31T23:59:59+07:00}% ก่อนปิดระบบ
```

ใน Live Preview และ Reading View ตัว placeholder จะกลายเป็น countdown ขนาดเล็ก
โดย syntax ต้นฉบับยังอยู่ในไฟล์ `.md` ตามเดิม เมื่อวาง cursor แตะ placeholder ใน
Live Preview ระบบจะแสดง syntax กลับมาให้แก้ไข

รองรับทั้งวันที่และวันพร้อมเวลา:

```md
%{count: 2026-12-31}%
%{count: 2026-12-31 18:30}%
%{count: 2026-12-31T18:30:00+07:00}%
```

ถ้าไม่ระบุ timezone จะใช้ timezone ของอุปกรณ์ แนะนำให้ใส่ `+07:00` เมื่อต้องการ
ให้แสดงตรงกันทุกอุปกรณ์ หรือเลือก **Markdown Widgets: Insert inline countdown
with date/time picker** จาก Command Palette แล้วเลือกวันและเวลาจากหน้าต่างที่เปิดขึ้น

Date/Time Picker มีทั้งช่องปฏิทินปกติและ Smart input ภาษาไทย/อังกฤษ:

```text
วันนี้ 18:30
พรุ่งนี้
tomorrow at 09:00
+30m
+2h
+3d
+1w 09:15
```

ถ้าไม่ระบุเวลา ระบบจะใช้ชั่วโมงและนาทีปัจจุบัน ปุ่ม preset รองรับวันนี้ พรุ่งนี้
และอีก 7 วัน ทุกค่าจะถูกแปลงเป็น ISO พร้อม timezone ก่อนเขียนลง Markdown

ใน Live Preview สามารถคลิก countdown ที่แสดงอยู่เพื่อเปิด Date/Time Picker และแก้ไข
วันกับเวลาเดิมได้ทันที ค่าที่เลือกจะถูกเขียนกลับเข้า placeholder พร้อม timezone ของเครื่อง

## Countdown sidebar

เลือกไอคอนรูปนาฬิกาที่ ribbon หรือเปิด Command Palette แล้วเลือก **Markdown Widgets:
Open countdown sidebar** เพื่อแสดงรายการ countdown ใน sidebar ด้านขวา รายการจะใช้
ข้อความที่เหลือในบรรทัดเป็นชื่อ แสดงไฟล์และเลขบรรทัด เรียงรายการอนาคตที่ใกล้ที่สุดก่อน
และจัดกลุ่มแบบ `ชื่อไฟล์ › Heading` โดย heading ชื่อเดียวกันจากคนละไฟล์จะไม่ถูกรวมกัน
รายการที่เลยเวลาแล้วยังคงแสดงต่อจากรายการอนาคต คลิกรายการเพื่อเปิดโน้ตตรง placeholder
นั้นได้ Placeholder ใน inline code และ fenced code block จะไม่ถูกนำมาแสดงใน Sidebar

เพื่อให้อ่านง่าย Countdown ที่เหลือเกินหนึ่งวันจะแสดงเฉพาะวันและชั่วโมง เช่น
`4 วัน 9 ชม.` และจะเปลี่ยนเป็น `09:47:53` เมื่อเหลือน้อยกว่าหนึ่งวัน

## Countdown

ใส่ fenced code block นี้ในโน้ต:

````md
```countdown
title: ส่งวิทยานิพนธ์
date: 2026-12-31T23:59:59+07:00
done: ถึงกำหนดแล้ว!
locale: th-TH
```
````

ปลั๊กอินจะแสดงจำนวนวัน ชั่วโมง นาที และวินาที พร้อมอัปเดตทุกวินาที
เมื่อถึงเวลาแล้ว ตัวเลขจะหยุดที่ศูนย์และแสดงข้อความจาก `done`

ค่าที่รองรับ:

- `date` (จำเป็น): วันและเวลาแบบ ISO 8601 แนะนำให้ใส่ timezone เช่น `+07:00`
- `title` (ไม่บังคับ): หัวข้อของ countdown
- `done` (ไม่บังคับ): ข้อความเมื่อถึงกำหนด
- `locale` (ไม่บังคับ): locale สำหรับแสดงวัน เช่น `th-TH` หรือ `en-US`
- `target`: ใช้แทน `date` ได้

เขียนเฉพาะวันที่ก็ได้:

````md
```countdown
2026-12-31T23:59:59+07:00
```
````

หรือเปิด Command Palette แล้วเลือก **Markdown Widgets: Insert countdown block with
date/time picker** เพื่อเลือกวันและเวลาด้วย Picker เดียวกับ Inline countdown

ดูโน้ตพร้อมใช้งานได้ที่ `examples/countdown-demo.md`

## Development

ต้องมี Node.js 18 ขึ้นไปและ pnpm:

```bash
pnpm install
pnpm test
pnpm build
```

ไฟล์ที่ Obsidian ใช้งานจริงคือ `main.js`, `manifest.json` และ `styles.css`
ให้นำทั้งสามไฟล์ไปไว้ที่:

```text
<vault>/.obsidian/plugins/markdown-widgets/
```

จากนั้นเปิด **Settings → Community plugins** แล้วเปิดใช้งาน **Markdown Widgets**

## Copy equation (MathJax)

คลิกขวาที่สมการที่ render แล้ว (`$...$` หรือ `$$...$$`) จะได้เมนู 3 อย่าง

| เมนู | ผลลัพธ์ |
| :-- | :-- |
| **Copy equation as image** | PNG พื้นหลังขาว ตัวอักษรดำ ขยาย 3× ลงคลิปบอร์ด |
| **Copy equation as SVG** | SVG เวกเตอร์ลงคลิปบอร์ดเป็น `image/svg+xml` (Inkscape / Illustrator paste ได้) |
| **Save equation as SVG…** | เปิด save dialog เขียนเป็นไฟล์ `.svg` |

ข้อจำกัดที่กำหนดวิธี implement:

- Obsidian ฝัง MathJax มาเฉพาะตัว **CommonHTML** (`tex-chtml-full.js`) ไม่มี SVG output
  ปลั๊กอินจึง bundle ตัว SVG renderer ของ MathJax เข้ามาเองในรูป **module** ไม่ใช่ script
  เพื่อไม่ให้ทับ `window.MathJax` ที่ Obsidian ใช้ render สมการอยู่ (`main.js` จึงใหญ่ ~1.8 MB)
- SVG ใช้ `fontCache: "local"` ให้ glyph ทุกตัวอยู่ใน `<svg>` เดียว ไฟล์จึง self-contained
- Obsidian ลบ LaTeX ต้นฉบับออกจาก DOM หลัง `tex2chtml` ปลั๊กอินจึงย้อนหา source สองทาง คือ
  `posAtDOM` ของ CodeMirror ใน Live Preview และ post-processor ที่แปะ `data-mw-tex`
  จาก section source ใน Reading View ถ้าจำนวนสมการไม่ตรงกันจะไม่แปะเลย แล้วรายงาน error
  แทนที่จะเดาว่าสมการไหนคู่กับอันไหน
- PNG ใช้ `webContents.capturePage()` โดย clone สมการไปวางใน overlay ชั่วคราวที่คุมพื้นหลังเอง
  และตั้ง `zoom` ให้ CHTML layout ใหม่ที่ 3× (คมจริง ไม่ใช่ขยายภาพ)

ต้องใช้ Obsidian เวอร์ชันเดสก์ท็อป เพราะทั้งการจับภาพและการเขียนคลิปบอร์ดแบบ `image/svg+xml`
ผ่าน Electron

## Verify release provenance

GitHub Release assets ถูก build และลงนามด้วย GitHub Artifact Attestations ผู้ใช้สามารถ
ตรวจสอบ provenance หลังดาวน์โหลดได้ด้วย GitHub CLI:

```bash
gh attestation verify main.js --repo PuemMTH/obsidian-markdown-widgets
gh attestation verify manifest.json --repo PuemMTH/obsidian-markdown-widgets
gh attestation verify styles.css --repo PuemMTH/obsidian-markdown-widgets
```

## Adding another widget

1. สร้างโมดูลใหม่ใต้ `src/widgets/<widget-name>/`
2. implement interface `MarkdownWidget` จาก `src/widgets/widget.ts`
3. เพิ่มโมดูลลงใน array ที่ `src/widgets/index.ts`
4. เพิ่ม test ของ parser หรือ logic แยกจาก DOM

แต่ละ widget จึงมี syntax, parser, renderer และ test ของตัวเองได้โดยไม่ผูกกับ Countdown
