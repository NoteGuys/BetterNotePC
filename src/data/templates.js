// Paper Sizes & Templates for BetterNote Studio Workflow

export const PAPER_SIZES = [
  {
    id: 'A4',
    name: 'A4',
    fullName: 'A4 (มาตรฐาน)',
    width: 1200,
    height: 1697,
    description: '210 × 297 มม. - ขนาดสมุดมาตรฐาน เหมาะสำหรับจดบันทึกและพิมพ์',
    badge: 'ยอดนิยม'
  },
  {
    id: 'A3',
    name: 'A3',
    fullName: 'A3 (ใหญ่ 2 เท่า)',
    width: 1697,
    height: 2400,
    description: '297 × 420 มม. - พื้นที่กว้าง 2 เท่า เหมาะสำหรับแผนผัง สรุปบทเรียน Mindmap',
    badge: 'กว้างพิเศษ'
  },
  {
    id: 'A2',
    name: 'A2',
    fullName: 'A2 (ใหญ่พิเศษ/โปสเตอร์)',
    width: 2400,
    height: 3394,
    description: '420 × 594 มม. - ขนาดโปสเตอร์และพิมพ์เขียว เหมาะสำหรับงานสถาปัตย์และงานสเก็ตช์ภาพใหญ่',
    badge: 'ขนาดยักษ์'
  }
];

export const PAPER_TEMPLATES = [
  {
    id: 'dotted',
    name: 'ลายจุด (Dotted)',
    description: 'จุดนำสายตาแบบ Bullet Journal สำหรับการวางแผน วาด และสเก็ตช์',
    bg: '#ffffff',
    dotColor: '#cbd5e1',
    spacing: 28,
    type: 'dotted',
    badge: 'ยอดนิยม'
  },
  {
    id: 'narrow-ruled',
    name: 'เส้นแคบ (Narrow Ruled)',
    description: 'เส้นบรรทัดระยะแคบ 22px สำหรับจดข้อความเนื้อหาแน่น หรือเขียนตัวเล็ก',
    bg: '#ffffff',
    lineColor: '#e2e8f0',
    spacing: 22,
    margin: 48,
    type: 'ruled',
    badge: 'เขียนละเอียด'
  },
  {
    id: 'wide-ruled',
    name: 'เส้นกว้าง (Wide Ruled)',
    description: 'เส้นบรรทัดระยะกว้าง 38px สำหรับเขียนตัวใหญ่ สรุปหัวข้อ หรือฝึกคัดลายมือ',
    bg: '#ffffff',
    lineColor: '#e2e8f0',
    spacing: 38,
    margin: 48,
    type: 'ruled',
    badge: 'เขียนสบาย'
  },
  {
    id: 'ruled',
    name: 'เส้นมาตรฐาน (Standard Ruled)',
    description: 'เส้นบรรทัด 30px มาตรฐานสมุดจดเลคเชอร์ทั่วไป',
    bg: '#ffffff',
    lineColor: '#e2e8f0',
    spacing: 30,
    margin: 48,
    type: 'ruled'
  },
  {
    id: 'grid',
    name: 'ตารางกราฟ (Grid)',
    description: 'ตาราง 5mm เหมาะสำหรับวิชาคณิตศาสตร์ กราฟ ตาราง และสถิติ',
    bg: '#ffffff',
    lineColor: '#e2e8f0',
    spacing: 26,
    type: 'grid'
  },
  {
    id: 'blank',
    name: 'กระดาษเปล่า (Blank)',
    description: 'หน้าขาวล้วน ไร้เส้น สำหรับวาดภาพ ไดอะแกรม และสเก็ตช์อิสระ',
    bg: '#ffffff',
    type: 'blank'
  },
  {
    id: 'cornell',
    name: 'คอร์เนลล์ (Cornell Notes)',
    description: 'แบบฟอร์มคอร์เนลล์ มีคอลัมน์คำสำคัญและกล่องสรุปด้านล่าง',
    bg: '#ffffff',
    lineColor: '#e2e8f0',
    cueWidth: 200,
    summaryHeight: 160,
    spacing: 28,
    type: 'cornell'
  },
  {
    id: 'dark-dotted',
    name: 'โทนดำลายจุด (Dark Dotted)',
    description: 'กระดาษสีเข้ม สบายตา ช่วยให้หมึกสีนีออนและสีขาวโดดเด่น',
    bg: '#18181b',
    dotColor: '#3f3f46',
    spacing: 28,
    type: 'dotted',
    isDark: true
  }
];

export const getPaperSize = (sizeId = 'A4', orientation = 'portrait') => {
  const size = PAPER_SIZES.find(s => s.id === sizeId) || PAPER_SIZES[0];
  if (orientation === 'landscape') {
    return {
      width: Math.max(size.width, size.height),
      height: Math.min(size.width, size.height)
    };
  }
  return {
    width: Math.min(size.width, size.height),
    height: Math.max(size.width, size.height)
  };
};
