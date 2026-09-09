# Markdown Widgets for Obsidian

ปลั๊กอินสำหรับเพิ่ม widget ที่อัปเดตสดลงใน Markdown โดยเริ่มจาก `countdown`
และวางโครงให้เพิ่ม widget ชนิดใหม่ภายหลังได้โดยไม่ต้องแก้ระบบเดิมทั้งหมด

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

หรือเปิด Command Palette แล้วเลือก **Markdown Widgets: Insert countdown block**
เพื่อแทรก template ที่ตั้งเวลาเริ่มต้นเป็น 24 ชั่วโมงข้างหน้า

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

## Adding another widget

1. สร้างโมดูลใหม่ใต้ `src/widgets/<widget-name>/`
2. implement interface `MarkdownWidget` จาก `src/widgets/widget.ts`
3. เพิ่มโมดูลลงใน array ที่ `src/widgets/index.ts`
4. เพิ่ม test ของ parser หรือ logic แยกจาก DOM

แต่ละ widget จึงมี syntax, parser, renderer และ test ของตัวเองได้โดยไม่ผูกกับ Countdown
