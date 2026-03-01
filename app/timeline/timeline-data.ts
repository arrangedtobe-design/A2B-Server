export const CATEGORIES = ["Preparation","Ceremony","Photos","Reception","Travel","Vendor","General"];
export const DURATION_OPTIONS = [5,10,15,20,30,45,60,90,120,150,180,240];
export const PIXELS_PER_MINUTE = 2;
export const MIN_EVENT_HEIGHT = 20;

export function formatTime(time:string):string{if(!time)return"";const[hours,minutes]=time.split(":");const h=parseInt(hours);const ampm=h>=12?"PM":"AM";const display=h===0?12:h>12?h-12:h;return`${display}:${minutes} ${ampm}`;}
export function getEndTime(st:string,dur:number):string{const[h,m]=st.split(":").map(Number);const t=h*60+m+dur;return`${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;}
export function formatDuration(min:number):string{if(min<60)return`${min} min`;const h=Math.floor(min/60),m=min%60;return m>0?`${h}h ${m}m`:`${h}h`;}
export function timeToMinutes(time:string):number{const[h,m]=time.split(":").map(Number);return h*60+m;}
export function minutesToTime(mins:number):string{const h=Math.floor(((mins%1440)+1440)%1440/60);const m=((mins%60)+60)%60;return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;}
export function formatHourLabel(h:number):string{const hr=((h%24)+24)%24;if(hr===0)return"12 AM";if(hr===12)return"12 PM";return hr>12?`${hr-12} PM`:`${hr} AM`;}

export interface LayoutItem {
  id: string;
  start_time: string;
  duration_minutes: number;
  category: string;
  [key: string]: any;
  _top: number;
  _height: number;
  _col: number;
  _colSpan: number;
  _totalCols: number;
}

export function layoutEvents(items: any[], dStartMin: number, dragId?: string | null, dragColFraction?: number | null): LayoutItem[] {
  if (!items.length) return [];

  const withPos = items.map(item => {
    const startMin = timeToMinutes(item.start_time);
    const top = (startMin - dStartMin) * PIXELS_PER_MINUTE;
    const height = Math.max(item.duration_minutes * PIXELS_PER_MINUTE, MIN_EVENT_HEIGHT);
    const endMin = startMin + item.duration_minutes;
    return { ...item, _top: top, _height: height, _startMin: startMin, _endMin: endMin, _col: 0, _colSpan: 1, _totalCols: 1 };
  });

  // Sweep-line: find max concurrency during each event's lifetime
  const sweepEvents: { min: number; type: "start" | "end"; idx: number }[] = [];
  for (let i = 0; i < withPos.length; i++) {
    sweepEvents.push({ min: withPos[i]._startMin, type: "start", idx: i });
    sweepEvents.push({ min: withPos[i]._endMin, type: "end", idx: i });
  }
  sweepEvents.sort((a, b) => a.min - b.min || (a.type === "end" ? -1 : 1));

  const maxConcurrent: number[] = new Array(withPos.length).fill(1);
  const active = new Set<number>();
  for (const ev of sweepEvents) {
    if (ev.type === "start") {
      active.add(ev.idx);
      const count = active.size;
      for (const idx of active) {
        if (count > maxConcurrent[idx]) maxConcurrent[idx] = count;
      }
    } else {
      active.delete(ev.idx);
    }
  }

  // Direct overlap pairs
  const overlaps: number[][] = Array.from({ length: withPos.length }, () => []);
  for (let i = 0; i < withPos.length; i++) {
    for (let j = i + 1; j < withPos.length; j++) {
      if (withPos[i]._startMin < withPos[j]._endMin && withPos[i]._endMin > withPos[j]._startMin) {
        overlaps[i].push(j);
        overlaps[j].push(i);
      }
    }
  }

  // Greedy column assignment sorted by sort_order then start_time
  const sorted = withPos
    .map((_, i) => i)
    .sort((a, b) => (withPos[a].sort_order ?? 0) - (withPos[b].sort_order ?? 0) || withPos[a]._startMin - withPos[b]._startMin);

  const colAssign: number[] = new Array(withPos.length).fill(-1);
  for (const idx of sorted) {
    const usedCols = new Set<number>();
    for (const other of overlaps[idx]) {
      if (colAssign[other] >= 0) usedCols.add(colAssign[other]);
    }
    let col = 0;
    while (usedCols.has(col)) col++;
    colAssign[idx] = col;
  }

  for (let i = 0; i < withPos.length; i++) {
    // totalCols must be at least maxConcurrent AND at least enough to fit 
    // the highest column among this event and its direct overlaps
    let maxCol = colAssign[i];
    for (const other of overlaps[i]) {
      if (colAssign[other] > maxCol) maxCol = colAssign[other];
    }
    withPos[i]._col = colAssign[i];
    withPos[i]._totalCols = Math.max(maxConcurrent[i], maxCol + 1);
  }

  // Expand column spans into empty adjacent columns
  for (let i = 0; i < withPos.length; i++) {
    if (withPos[i]._totalCols <= 1) continue;
    const myStart = withPos[i]._startMin;
    const myEnd = withPos[i]._endMin;
    let rightCol = withPos[i]._col;
    
    while (rightCol < withPos[i]._totalCols - 1) {
      const testCol = rightCol + 1;
      // Check if any direct overlap occupies this column
      const blocked = overlaps[i].some(other => colAssign[other] === testCol);
      if (blocked) break;
      rightCol = testCol;
    }
    withPos[i]._colSpan = rightCol - withPos[i]._col + 1;
  }

  // Drag column preference
  if (dragId && dragColFraction !== null && dragColFraction !== undefined) {
    const dragIdx = withPos.findIndex(item => item.id === dragId);
    if (dragIdx >= 0 && overlaps[dragIdx].length > 0) {
      const totalCols = withPos[dragIdx]._totalCols;
      const targetCol = Math.min(Math.floor(dragColFraction * totalCols), totalCols - 1);
      const currentCol = colAssign[dragIdx];
      if (targetCol !== currentCol) {
        const occupant = overlaps[dragIdx].find(other => colAssign[other] === targetCol);
        if (occupant !== undefined) {
          colAssign[occupant] = currentCol;
          withPos[occupant]._col = currentCol;
        }
        colAssign[dragIdx] = targetCol;
        withPos[dragIdx]._col = targetCol;
      }
    }
  }

  return withPos;
}
export interface Template{id:string;name:string;description:string;eventCount:number;duration:string;icon:string;startHour:number;endHour:number;events:{title:string;start_time:string;duration_minutes:number;category:string;location?:string;notes?:string}[];}

export const TEMPLATES:Template[]=[
{id:"traditional",name:"Traditional Ceremony & Reception",description:"Full day from getting ready through send-off.",eventCount:18,duration:"~10 hours",icon:"\u2661",startHour:7,endHour:20,events:[
{title:"Hair & Makeup \u2014 Bride",start_time:"08:00",duration_minutes:90,category:"Preparation",location:"Bridal Suite"},
{title:"Hair & Makeup \u2014 Bridesmaids",start_time:"09:30",duration_minutes:60,category:"Preparation",location:"Bridal Suite"},
{title:"Groom & Groomsmen Getting Ready",start_time:"10:00",duration_minutes:60,category:"Preparation",location:"Groom Suite"},
{title:"Bride Gets Dressed",start_time:"11:00",duration_minutes:30,category:"Preparation",location:"Bridal Suite"},
{title:"Bridal Party First Look",start_time:"11:30",duration_minutes:15,category:"Photos"},
{title:"Family Photos \u2014 Bride Side",start_time:"11:45",duration_minutes:20,category:"Photos"},
{title:"Family Photos \u2014 Groom Side",start_time:"12:05",duration_minutes:20,category:"Photos"},
{title:"Wedding Party Photos",start_time:"12:30",duration_minutes:30,category:"Photos"},
{title:"Guests Arrive & Are Seated",start_time:"13:15",duration_minutes:30,category:"Ceremony"},
{title:"Ceremony",start_time:"13:45",duration_minutes:30,category:"Ceremony"},
{title:"Cocktail Hour",start_time:"14:15",duration_minutes:60,category:"Reception",location:"Patio"},
{title:"Couple Photos (Golden Hour)",start_time:"14:30",duration_minutes:30,category:"Photos"},
{title:"Grand Entrance & First Dance",start_time:"15:15",duration_minutes:15,category:"Reception",location:"Ballroom"},
{title:"Welcome Toast & Dinner",start_time:"15:30",duration_minutes:60,category:"Reception",location:"Ballroom"},
{title:"Speeches & Toasts",start_time:"16:30",duration_minutes:30,category:"Reception"},
{title:"Cake Cutting",start_time:"17:00",duration_minutes:15,category:"Reception"},
{title:"Open Dancing",start_time:"17:15",duration_minutes:120,category:"Reception"},
{title:"Sparkler Send-Off",start_time:"19:15",duration_minutes:15,category:"Reception"},
]},
{id:"first-look",name:"First Look Timeline",description:"Extended photo sessions before ceremony with first look.",eventCount:22,duration:"~12 hours",icon:"\u25ce",startHour:6,endHour:22,events:[
{title:"Hair & Makeup \u2014 Bride",start_time:"07:00",duration_minutes:120,category:"Preparation",location:"Bridal Suite"},
{title:"Hair & Makeup \u2014 Bridesmaids",start_time:"07:30",duration_minutes:90,category:"Preparation",location:"Bridal Suite"},
{title:"Groom & Groomsmen Getting Ready",start_time:"08:30",duration_minutes:60,category:"Preparation",location:"Groom Suite"},
{title:"Bride Gets Dressed",start_time:"09:30",duration_minutes:30,category:"Preparation",location:"Bridal Suite"},
{title:"First Look \u2014 Couple",start_time:"10:00",duration_minutes:30,category:"Photos",location:"Garden"},
{title:"Couple Photos",start_time:"10:30",duration_minutes:45,category:"Photos",location:"Garden"},
{title:"Wedding Party Photos",start_time:"11:15",duration_minutes:30,category:"Photos"},
{title:"Family Portraits \u2014 Bride Side",start_time:"11:45",duration_minutes:20,category:"Photos"},
{title:"Family Portraits \u2014 Groom Side",start_time:"12:05",duration_minutes:20,category:"Photos"},
{title:"Lunch Break",start_time:"12:30",duration_minutes:45,category:"Preparation"},
{title:"Touch-Up Hair & Makeup",start_time:"13:15",duration_minutes:30,category:"Preparation"},
{title:"Travel to Venue",start_time:"13:45",duration_minutes:30,category:"Travel"},
{title:"Guests Arrive",start_time:"14:30",duration_minutes:30,category:"Ceremony"},
{title:"Ceremony",start_time:"15:00",duration_minutes:30,category:"Ceremony"},
{title:"Receiving Line",start_time:"15:30",duration_minutes:20,category:"Ceremony"},
{title:"Cocktail Hour",start_time:"15:50",duration_minutes:60,category:"Reception",location:"Patio"},
{title:"Grand Entrance",start_time:"16:50",duration_minutes:10,category:"Reception"},
{title:"First Dance",start_time:"17:00",duration_minutes:5,category:"Reception"},
{title:"Dinner Service",start_time:"17:05",duration_minutes:75,category:"Reception"},
{title:"Speeches & Toasts",start_time:"18:20",duration_minutes:30,category:"Reception"},
{title:"Cake Cutting & Dancing",start_time:"18:50",duration_minutes:120,category:"Reception"},
{title:"Grand Exit",start_time:"20:50",duration_minutes:15,category:"Reception"},
]},
{id:"ceremony-only",name:"Ceremony Only / Elopement",description:"Simplified schedule for intimate ceremonies.",eventCount:8,duration:"~4 hours",icon:"\u25c7",startHour:11,endHour:18,events:[
{title:"Getting Ready Together",start_time:"12:00",duration_minutes:60,category:"Preparation"},
{title:"Travel to Location",start_time:"13:00",duration_minutes:30,category:"Travel"},
{title:"Pre-Ceremony Photos",start_time:"13:30",duration_minutes:30,category:"Photos"},
{title:"Ceremony",start_time:"14:00",duration_minutes:20,category:"Ceremony"},
{title:"Post-Ceremony Photos",start_time:"14:20",duration_minutes:40,category:"Photos"},
{title:"Travel to Venue",start_time:"15:00",duration_minutes:20,category:"Travel"},
{title:"Intimate Dinner",start_time:"15:30",duration_minutes:90,category:"Reception"},
{title:"Dessert & Celebration",start_time:"17:00",duration_minutes:60,category:"Reception"},
]},
{id:"destination",name:"Destination / Weekend",description:"Multi-day with welcome dinner and brunch.",eventCount:20,duration:"3 days",icon:"\u2605",startHour:7,endHour:22,events:[
{title:"Guest Check-In",start_time:"14:00",duration_minutes:120,category:"Reception",notes:"Day 1"},
{title:"Welcome Dinner",start_time:"18:00",duration_minutes:120,category:"Reception"},
{title:"Hair & Makeup",start_time:"08:00",duration_minutes:90,category:"Preparation",notes:"Day 2"},
{title:"Groom Getting Ready",start_time:"09:00",duration_minutes:60,category:"Preparation"},
{title:"First Look",start_time:"10:30",duration_minutes:30,category:"Photos"},
{title:"Couple Photos",start_time:"11:00",duration_minutes:45,category:"Photos"},
{title:"Wedding Party Photos",start_time:"11:45",duration_minutes:30,category:"Photos"},
{title:"Lunch & Rest",start_time:"12:45",duration_minutes:60,category:"Preparation"},
{title:"Guests Arrive",start_time:"14:30",duration_minutes:30,category:"Ceremony"},
{title:"Ceremony",start_time:"15:00",duration_minutes:30,category:"Ceremony"},
{title:"Cocktail Hour",start_time:"15:30",duration_minutes:60,category:"Reception"},
{title:"Dinner",start_time:"16:45",duration_minutes:75,category:"Reception"},
{title:"Speeches",start_time:"18:00",duration_minutes:30,category:"Reception"},
{title:"Dancing",start_time:"18:45",duration_minutes:120,category:"Reception"},
{title:"Send-Off",start_time:"21:00",duration_minutes:15,category:"Reception"},
{title:"Farewell Brunch",start_time:"10:00",duration_minutes:120,category:"Reception",notes:"Day 3"},
]},
];
