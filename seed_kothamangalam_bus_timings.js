import pool from './configs/db.js';

// Helper to convert 24-hr (or raw) time to 12-hr format with AM/PM (e.g., "08:30 AM", "01:15 PM")
function to12Hour(timeStr) {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return timeStr;
  if (match[3]) {
    const h = String(parseInt(match[1], 10)).padStart(2, '0');
    return `${h}:${match[2]} ${match[3].toUpperCase()}`;
  }
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

// Helper to add minutes and return in 12-hour format with AM/PM
function addMinutes12Hour(timeStr, mins) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return timeStr;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  }
  const total = (h * 60 + m + mins) % (24 * 60);
  const newH24 = Math.floor(total / 60);
  const newM = String(total % 60).padStart(2, '0');
  const newAmpm = newH24 >= 12 ? 'PM' : 'AM';
  const newH12 = String(newH24 % 12 || 12).padStart(2, '0');
  return `${newH12}:${newM} ${newAmpm}`;
}

const ALL_DAYS = JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

// Core KSRTC & Other State Gov seed routes (formatted in 12-hour AM/PM)
const GOV_ROUTES = [
  [
    'KSRTC',
    '05:30 AM',
    'Kothamangalam KSRTC Depot',
    'Kothamangalam → Perumbavoor → Aluva → Ernakulam',
    '08:15 AM',
    'Ernakulam Bus Terminal',
    JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
    1,
    'System Seed',
    'System Seed'
  ],
  [
    'KSRTC',
    '07:00 AM',
    'Kothamangalam KSRTC Depot',
    'Kothamangalam → Thodupuzha → Kumily',
    '10:45 AM',
    'Kumily Bus Stand',
    JSON.stringify(['Sun', 'Mon', 'Wed', 'Fri']),
    1,
    'System Seed',
    'System Seed'
  ],
  [
    'KSRTC',
    '09:00 AM',
    'Kothamangalam KSRTC Depot',
    'Kothamangalam → Munnar',
    '12:30 PM',
    'Munnar Bus Stand',
    JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
    1,
    'System Seed',
    'System Seed'
  ],
  [
    'Other State Gov',
    '10:00 AM',
    'Kothamangalam KSRTC Depot',
    'Kothamangalam → Coimbatore',
    '02:30 PM',
    'Coimbatore Bus Stand',
    JSON.stringify(['Mon', 'Wed', 'Fri']),
    1,
    'System Seed',
    'System Seed'
  ]
];

// All 37 Private bus routes based on https://www.tickettogetlost.com/2025/10/16/bus-timings-from-kothamangalam-private-bus-stand/
const ROUTES_DATA = [
  {
    destination: 'Mamalakandam',
    durationMins: 90,
    outboundWaypoints: 'Kothamangalam → Keerampara → Thattekkad → Kuttampuzha → Mamalakandam',
    returnWaypoints: 'Mamalakandam → Kuttampuzha → Thattekkad → Keerampara → Kothamangalam',
    outboundTimings: ['08:30', '08:50', '10:00', '13:00', '16:40'],
    returnTimings: ['07:20', '10:30', '10:40', '12:00', '15:20'],
  },
  {
    destination: 'Vadattupara',
    durationMins: 45,
    outboundWaypoints: 'Kothamangalam → Keerampara → Chelad → Vadattupara',
    returnWaypoints: 'Vadattupara → Chelad → Keerampara → Kothamangalam',
    outboundTimings: [
      '07:20', '08:00', '08:20', '09:00', '09:45', '10:15', '10:40', '11:20',
      '12:45', '13:15', '13:40', '14:00', '15:00', '15:30', '16:00', '17:20',
      '17:40', '17:50', '18:45', '19:40', '20:30'
    ],
    returnTimings: [
      '06:00', '06:20', '06:40', '07:00', '07:20', '08:40', '09:20', '09:40',
      '10:00', '11:10', '11:30', '12:00', '12:50', '14:00', '14:20', '14:45',
      '15:45', '16:00', '17:00', '17:20'
    ],
  },
  {
    destination: 'Pooyamkutty',
    durationMins: 50,
    outboundWaypoints: 'Kothamangalam → Nellimattom → Kavalangad → Thattekkad → Kuttampuzha → Pooyamkutty',
    returnWaypoints: 'Pooyamkutty → Kuttampuzha → Thattekkad → Kavalangad → Nellimattom → Kothamangalam',
    outboundTimings: [
      '07:30', '08:30', '09:00', '09:50', '10:30', '12:40', '13:00', '13:40',
      '14:30', '15:15', '16:30', '17:00', '17:20', '17:30', '18:00', '18:20', '18:50'
    ],
    returnTimings: [
      '05:45', '06:30', '06:40', '07:40', '08:00', '09:30', '10:00', '10:30',
      '12:00', '12:45', '14:40', '15:15', '15:45', '16:20', '17:30'
    ],
  },
  {
    destination: 'Perumbavoor',
    durationMins: 35,
    outboundWaypoints: 'Kothamangalam → Nellipoyil → Kuruppampady → Perumbavoor',
    returnWaypoints: 'Perumbavoor → Kuruppampady → Nellipoyil → Kothamangalam',
    outboundTimings: [
      '06:00', '06:20', '06:40', '07:00', '07:20', '07:40', '08:00', '08:20', '08:40', '09:00',
      '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:30', '12:00', '12:30', '13:00',
      '13:30', '14:00', '14:20', '14:40', '15:00', '15:20', '15:40', '16:00', '16:20', '16:40',
      '17:00', '17:20', '17:40', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ],
    returnTimings: [
      '06:00', '06:20', '06:40', '07:00', '07:20', '07:40', '08:00', '08:20', '08:40', '09:00',
      '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:30', '12:00', '12:30', '13:00',
      '13:30', '14:00', '14:20', '14:40', '15:00', '15:20', '15:40', '16:00', '16:20', '16:40',
      '17:00', '17:20', '17:40', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ],
  },
  {
    destination: 'Muvattupuzha',
    durationMins: 35,
    outboundWaypoints: 'Kothamangalam → Kaloor → Pezhakkappilly → Muvattupuzha',
    returnWaypoints: 'Muvattupuzha → Pezhakkappilly → Kaloor → Kothamangalam',
    outboundTimings: [
      '06:00', '06:20', '06:40', '07:00', '07:20', '07:40', '08:00', '08:20', '08:40', '09:00',
      '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:30', '12:00', '12:30', '13:00',
      '13:30', '14:00', '14:20', '14:40', '15:00', '15:20', '15:40', '16:00', '16:20', '16:40',
      '17:00', '17:20', '17:40', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ],
    returnTimings: [
      '06:00', '06:20', '06:40', '07:00', '07:20', '07:40', '08:00', '08:20', '08:40', '09:00',
      '09:20', '09:40', '10:00', '10:20', '10:40', '11:00', '11:30', '12:00', '12:30', '13:00',
      '13:30', '14:00', '14:20', '14:40', '15:00', '15:20', '15:40', '16:00', '16:20', '16:40',
      '17:00', '17:20', '17:40', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ],
  },
  {
    destination: 'Thalayolaparambu',
    durationMins: 105,
    outboundWaypoints: 'Kothamangalam → Muvattupuzha → Piravom → Thalayolaparambu',
    returnWaypoints: 'Thalayolaparambu → Piravom → Muvattupuzha → Kothamangalam',
    outboundTimings: ['09:45', '16:30'],
    returnTimings: ['06:15', '13:20'],
  },
  {
    destination: 'Koothattukulam',
    durationMins: 75,
    outboundWaypoints: 'Kothamangalam → Muvattupuzha → Marady → Koothattukulam',
    returnWaypoints: 'Koothattukulam → Marady → Muvattupuzha → Kothamangalam',
    outboundTimings: ['06:40', '08:00', '12:20', '16:45'],
    returnTimings: ['10:15', '14:20', '19:30'],
  },
  {
    destination: 'Angamaly',
    durationMins: 70,
    outboundWaypoints: 'Kothamangalam → Kalady → Mattoor → Angamaly',
    returnWaypoints: 'Angamaly → Mattoor → Kalady → Kothamangalam',
    outboundTimings: [
      '07:15', '08:00', '10:15', '10:50', '11:45', '13:20', '14:20', '14:45',
      '15:50', '16:45', '17:15', '17:45'
    ],
    returnTimings: [
      '06:10', '06:30', '08:00', '08:30', '09:00', '09:50', '12:30', '13:40',
      '14:20', '14:40', '16:15', '16:30', '19:40'
    ],
  },
  {
    destination: 'Kalady',
    durationMins: 40,
    outboundWaypoints: 'Kothamangalam → Kuruppampady → Kalady',
    returnWaypoints: 'Kalady → Kuruppampady → Kothamangalam',
    outboundTimings: ['06:45', '07:30', '11:00', '15:40', '17:15'],
    returnTimings: ['08:45', '09:50', '13:20', '17:40'],
  },
  {
    destination: 'Munnar',
    durationMins: 195,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Cheeyappara → Adimaly → Munnar',
    returnWaypoints: 'Munnar → Adimaly → Cheeyappara → Neriamangalam → Kothamangalam',
    outboundTimings: [
      '04:30', '05:50', '07:20', '08:00', '08:30', '09:00', '10:00',
      '13:15', '13:45', '14:45', '15:30', '19:30'
    ],
    returnTimings: ['06:00', '07:30', '09:15', '11:30', '13:00', '14:30', '16:00', '17:30'],
  },
  {
    destination: 'Devikulam',
    durationMins: 210,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Adimaly → Munnar → Devikulam',
    returnWaypoints: 'Devikulam → Munnar → Adimaly → Neriamangalam → Kothamangalam',
    outboundTimings: ['05:50', '08:00', '09:00'],
    returnTimings: ['09:30', '17:00'],
  },
  {
    destination: 'Koviloor',
    durationMins: 255,
    outboundWaypoints: 'Kothamangalam → Adimaly → Munnar → Marayoor → Koviloor',
    returnWaypoints: 'Koviloor → Marayoor → Munnar → Adimaly → Kothamangalam',
    outboundTimings: ['08:30'],
    returnTimings: ['09:50', '13:45'],
  },
  {
    destination: 'Kanthalloor',
    durationMins: 270,
    outboundWaypoints: 'Kothamangalam → Adimaly → Munnar → Marayoor → Kanthalloor',
    returnWaypoints: 'Kanthalloor → Marayoor → Munnar → Adimaly → Kothamangalam',
    outboundTimings: ['07:20', '10:20', '13:10', '13:30', '15:30'],
    returnTimings: ['03:15', '05:10', '16:00', '16:30'],
  },
  {
    destination: 'Adimaly',
    durationMins: 90,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Cheeyappara → Valara → Adimaly',
    returnWaypoints: 'Adimaly → Valara → Cheeyappara → Neriamangalam → Kothamangalam',
    outboundTimings: [
      '06:30', '07:20', '08:00', '08:30', '08:50', '09:00', '10:00', '10:30',
      '11:20', '11:45', '12:00', '12:30', '13:15', '13:30', '13:40', '13:45',
      '13:50', '14:40', '14:45', '15:30', '16:40', '17:30', '18:30', '18:50',
      '19:15', '19:20', '20:10'
    ],
    returnTimings: [
      '04:30', '05:30', '06:00', '06:50', '07:50', '08:15', '08:40', '08:45',
      '09:10', '09:15', '09:40', '10:30', '10:50', '11:00', '11:30', '12:50',
      '14:45', '15:30', '16:15', '16:20', '16:50', '17:00', '17:15', '18:00',
      '18:40', '19:30'
    ],
  },
  {
    destination: 'Mankulam',
    durationMins: 165,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Adimaly → Kallar → Mankulam',
    returnWaypoints: 'Mankulam → Kallar → Adimaly → Neriamangalam → Kothamangalam',
    outboundTimings: ['09:30', '15:20'],
    returnTimings: ['06:00', '07:50', '12:20'],
  },
  {
    destination: 'Bison Valley',
    durationMins: 165,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Adimaly → Anachal → Bison Valley',
    returnWaypoints: 'Bison Valley → Anachal → Adimaly → Neriamangalam → Kothamangalam',
    outboundTimings: ['07:20', '11:20', '13:50', '15:50'],
    returnTimings: ['06:15', '08:30', '10:50', '14:50', '17:15'],
  },
  {
    destination: 'Muttukad',
    durationMins: 150,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Adimaly → Muttukad',
    returnWaypoints: 'Muttukad → Adimaly → Neriamangalam → Kothamangalam',
    outboundTimings: ['15:50'],
    returnTimings: ['06:00'],
  },
  {
    destination: 'Rajakkad',
    durationMins: 165,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Adimaly → Kallarkutty → Rajakkad',
    returnWaypoints: 'Rajakkad → Kallarkutty → Adimaly → Neriamangalam → Kothamangalam',
    outboundTimings: ['10:20', '11:45', '12:30', '12:40', '16:30', '18:30', '19:15'],
    returnTimings: ['04:20', '06:30', '07:30', '14:20', '15:00', '15:40'],
  },
  {
    destination: 'Pooppara',
    durationMins: 195,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Adimaly → Rajakumari → Pooppara',
    returnWaypoints: 'Pooppara → Rajakumari → Adimaly → Neriamangalam → Kothamangalam',
    outboundTimings: ['12:30', '13:30', '14:30', '16:30', '18:30'],
    returnTimings: ['05:30', '07:00', '09:45', '14:15'],
  },
  {
    destination: 'Nedumkandam',
    durationMins: 210,
    outboundWaypoints: 'Kothamangalam → Adimaly → Rajakkad → Nedumkandam',
    returnWaypoints: 'Nedumkandam → Rajakkad → Adimaly → Kothamangalam',
    outboundTimings: ['13:30', '15:00'],
    returnTimings: ['06:00', '08:30'],
  },
  {
    destination: 'Panickankudy',
    durationMins: 150,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Chelachuvadu → Panickankudy',
    returnWaypoints: 'Panickankudy → Chelachuvadu → Neriamangalam → Kothamangalam',
    outboundTimings: ['08:40', '15:00'],
    returnTimings: ['09:10', '11:00'],
  },
  {
    destination: 'Thopramkudy',
    durationMins: 165,
    outboundWaypoints: 'Kothamangalam → Chelachuvadu → Murickassery → Thopramkudy',
    returnWaypoints: 'Thopramkudy → Murickassery → Chelachuvadu → Kothamangalam',
    outboundTimings: ['17:30'],
    returnTimings: ['07:20'],
  },
  {
    destination: 'Erattayar',
    durationMins: 195,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Kattappana → Erattayar',
    returnWaypoints: 'Erattayar → Kattappana → Neriamangalam → Kothamangalam',
    outboundTimings: ['11:30'],
    returnTimings: ['15:15'],
  },
  {
    destination: 'Kattappana',
    durationMins: 225,
    outboundWaypoints: 'Kothamangalam → Chelachuvadu → Thopramkudy → Kattappana',
    returnWaypoints: 'Kattappana → Thopramkudy → Chelachuvadu → Kothamangalam',
    outboundTimings: ['11:30', '19:20', '21:00'],
    returnTimings: ['05:00', '07:30', '14:00'],
  },
  {
    destination: 'Kumily',
    durationMins: 270,
    outboundWaypoints: 'Kothamangalam → Neriamangalam → Kattappana → Kumily',
    returnWaypoints: 'Kumily → Kattappana → Neriamangalam → Kothamangalam',
    outboundTimings: ['01:45', '19:20', '21:00'],
    returnTimings: ['06:30', '11:15', '15:00'],
  },
  {
    destination: 'Vellaramkuthu',
    durationMins: 75,
    outboundWaypoints: 'Kothamangalam → Kavalangad → Neriamangalam → Vellaramkuthu',
    returnWaypoints: 'Vellaramkuthu → Neriamangalam → Kavalangad → Kothamangalam',
    outboundTimings: [
      '07:30', '08:30', '09:00', '09:50', '10:30', '13:00', '13:40', '14:30',
      '15:15', '16:30', '17:00', '17:20', '18:50'
    ],
    returnTimings: [
      '05:30', '06:00', '06:30', '07:30', '07:50', '09:20', '09:50', '10:20',
      '11:50', '12:30', '14:30', '15:30', '16:10', '17:20'
    ],
  },
  {
    destination: 'Pinavoorkudy',
    durationMins: 60,
    outboundWaypoints: 'Kothamangalam → Pothanicad → Pinavoorkudy',
    returnWaypoints: 'Pinavoorkudy → Pothanicad → Kothamangalam',
    outboundTimings: [
      '07:00', '08:00', '08:50', '10:20', '11:20', '12:00', '13:20', '14:00',
      '15:00', '16:15', '18:20'
    ],
    returnTimings: [
      '06:15', '07:20', '08:45', '09:45', '11:00', '12:15', '13:30', '14:00',
      '14:50', '15:30', '16:45'
    ],
  },
  {
    destination: 'Urulanthanni',
    durationMins: 45,
    outboundWaypoints: 'Kothamangalam → Thattekkad → Urulanthanni',
    returnWaypoints: 'Urulanthanni → Thattekkad → Kothamangalam',
    outboundTimings: ['09:20', '18:30', '18:50'],
    returnTimings: ['05:45', '06:45', '10:40'],
  },
  {
    destination: 'Charupara',
    durationMins: 45,
    outboundWaypoints: 'Kothamangalam → Varappetty → Charupara',
    returnWaypoints: 'Charupara → Varappetty → Kothamangalam',
    outboundTimings: [
      '07:10', '08:40', '09:30', '11:10', '11:40', '13:30', '15:10', '17:10', '20:50'
    ],
    returnTimings: [
      '06:00', '07:00', '07:50', '10:50', '12:10', '12:30', '14:30', '16:10', '18:15'
    ],
  },
  {
    destination: 'Uppukulam',
    durationMins: 40,
    outboundWaypoints: 'Kothamangalam → Nellimattom → Uppukulam',
    returnWaypoints: 'Uppukulam → Nellimattom → Kothamangalam',
    outboundTimings: ['06:40', '07:30', '07:45', '15:20', '17:15'],
    returnTimings: ['07:45', '08:15', '09:15', '16:00', '18:00'],
  },
  {
    destination: 'Vazhakulam',
    durationMins: 45,
    outboundWaypoints: 'Kothamangalam → Kaloor → Ayavana → Vazhakulam',
    returnWaypoints: 'Vazhakulam → Ayavana → Kaloor → Kothamangalam',
    outboundTimings: [
      '06:30', '07:00', '09:00', '10:20', '11:50', '12:15', '14:20', '15:10',
      '16:00', '17:30', '19:45'
    ],
    returnTimings: [
      '06:00', '07:50', '08:45', '10:10', '10:40', '13:15', '14:00', '14:50',
      '16:10', '17:40', '18:20', '19:00'
    ],
  },
  {
    destination: 'Paingottoor',
    durationMins: 35,
    outboundWaypoints: 'Kothamangalam → Pothanicad → Paingottoor',
    returnWaypoints: 'Paingottoor → Pothanicad → Kothamangalam',
    outboundTimings: [
      '06:10', '07:30', '07:40', '07:50', '08:15', '09:20', '10:15', '11:00',
      '11:40', '14:00', '14:30', '14:50', '17:00', '19:30'
    ],
    returnTimings: [
      '06:15', '06:20', '07:00', '08:20', '08:45', '09:15', '09:20', '10:45',
      '12:15', '12:45', '13:20', '15:45', '16:00', '16:40', '17:20', '18:30'
    ],
  },
  {
    destination: 'Manippara',
    durationMins: 45,
    outboundWaypoints: 'Kothamangalam → Paingottoor → Manippara',
    returnWaypoints: 'Manippara → Paingottoor → Kothamangalam',
    outboundTimings: ['09:40', '14:30', '17:00'],
    returnTimings: ['10:15', '15:45', '18:00'],
  },
  {
    destination: 'Kaliyar',
    durationMins: 50,
    outboundWaypoints: 'Kothamangalam → Paingottoor → Kaliyar',
    returnWaypoints: 'Kaliyar → Paingottoor → Kothamangalam',
    outboundTimings: ['07:30', '08:10', '11:00', '11:45', '14:00', '15:10', '19:20'],
    returnTimings: ['05:45', '06:20', '08:45', '09:30', '12:30', '13:20', '15:20', '16:45'],
  },
  {
    destination: 'Chathamattam',
    durationMins: 45,
    outboundWaypoints: 'Kothamangalam → Pothanicad → Chathamattam',
    returnWaypoints: 'Chathamattam → Pothanicad → Kothamangalam',
    outboundTimings: ['06:00', '08:45', '13:15', '16:30', '17:15', '18:40'],
    returnTimings: ['05:50', '07:00', '10:00', '14:15', '14:40', '19:30'],
  },
  {
    destination: 'Vettilappara',
    durationMins: 50,
    outboundWaypoints: 'Kothamangalam → Keerampara → Vettilappara',
    returnWaypoints: 'Vettilappara → Keerampara → Kothamangalam',
    outboundTimings: ['09:00', '11:20', '12:30', '17:40', '20:20'],
    returnTimings: ['07:40', '09:30', '12:00', '13:20', '18:15'],
  },
  {
    destination: 'Malippara',
    durationMins: 40,
    outboundWaypoints: 'Kothamangalam → Keerampara → Malippara',
    returnWaypoints: 'Malippara → Keerampara → Kothamangalam',
    outboundTimings: ['11:50', '15:30', '17:00'],
    returnTimings: ['12:20', '16:00', '17:30'],
  },
];

async function seedBusTimings12Hour() {
  console.log('🚀 Starting Kothamangalam Bus Timings Seeding (12-Hour AM/PM format)...');

  // 1. Ensure columns support 20 characters
  await pool.query(`
    ALTER TABLE bus_timings 
      MODIFY COLUMN departure_time VARCHAR(20) NOT NULL,
      MODIFY COLUMN destination_time VARCHAR(20) NOT NULL;
  `);
  console.log('✓ Columns altered to VARCHAR(20) to store 12-hour AM/PM strings.');

  // 2. Clear ALL existing data
  const [delResult] = await pool.query(`DELETE FROM bus_timings`);
  console.log(`🧹 Deleted ${delResult.affectedRows} existing bus timing records.`);

  const tripsToInsert = [];

  // 3. Add core government (KSRTC & Other State) routes
  for (const g of GOV_ROUTES) {
    tripsToInsert.push(g);
  }

  // 4. Add all 37 private routes in 12-hour AM/PM format
  for (const r of ROUTES_DATA) {
    const destStand = `${r.destination} Bus Stand`;
    const originStand = 'Kothamangalam Private Bus Stand';

    // Outbound Trips (Kothamangalam -> Destination)
    for (const depTimeRaw of r.outboundTimings) {
      const dep12 = to12Hour(depTimeRaw);
      const arr12 = addMinutes12Hour(depTimeRaw, r.durationMins);
      tripsToInsert.push([
        'Private',
        dep12,
        originStand,
        r.outboundWaypoints,
        arr12,
        destStand,
        ALL_DAYS,
        0,
        'System Seed (Ticket To Get Lost)',
        'System Seed (Ticket To Get Lost)',
      ]);
    }

    // Return Trips (Destination -> Kothamangalam)
    for (const depTimeRaw of r.returnTimings) {
      const dep12 = to12Hour(depTimeRaw);
      const arr12 = addMinutes12Hour(depTimeRaw, r.durationMins);
      tripsToInsert.push([
        'Private',
        dep12,
        destStand,
        r.returnWaypoints,
        arr12,
        originStand,
        ALL_DAYS,
        0,
        'System Seed (Ticket To Get Lost)',
        'System Seed (Ticket To Get Lost)',
      ]);
    }
  }

  console.log(`📦 Prepared ${tripsToInsert.length} total scheduled bus trips across all routes.`);

  const insertSql = `
    INSERT INTO bus_timings
      (type, departure_time, departure_stand, route, destination_time, destination_stand, days, reservation, created_by_name, updated_by_name)
    VALUES ?
  `;

  await pool.query(insertSql, [tripsToInsert]);
  console.log(`✅ Successfully seeded ${tripsToInsert.length} bus trips in 12-hour AM/PM format!`);

  // Verify sample output
  const [sampleRows] = await pool.query(`
    SELECT id, type, departure_time, departure_stand, destination_time, destination_stand 
    FROM bus_timings 
    WHERE destination_stand = 'Pooyamkutty Bus Stand' OR destination_stand = 'Munnar Bus Stand'
    LIMIT 6
  `);
  console.log('\n🔍 Sample Seeded Records (12-Hour AM/PM):');
  console.table(sampleRows);

  const [[totalCount]] = await pool.query('SELECT COUNT(*) as total FROM bus_timings');
  console.log(`\n🎉 Total Bus Timings in Database: ${totalCount.total}`);

  process.exit(0);
}

seedBusTimings12Hour().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
