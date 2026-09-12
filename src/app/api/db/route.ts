import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import defaultDataset from '@/data/dataset.json';

const STATE_FILE = path.resolve(process.cwd(), 'data', 'db-state.json');

export async function GET() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(content);
      return NextResponse.json({ success: true, source: 'file', data });
    }
    return NextResponse.json({ success: true, source: 'default', data: defaultDataset });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return NextResponse.json({ success: true, message: 'Database persistito su disco' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
