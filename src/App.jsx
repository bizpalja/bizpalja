import { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";

// ── 천간 지지 상수 ──────────────────────────────────────────
const STEMS   = ["갑(甲)","을(乙)","병(丙)","정(丁)","무(戊)","기(己)","경(庚)","신(辛)","임(壬)","계(癸)"];
const BRANCHES= ["자(子)","축(丑)","인(寅)","묘(卯)","진(辰)","사(巳)","오(午)","미(未)","신(申)","유(酉)","술(戌)","해(亥)"];
const STEM_E  = ["목","목","화","화","토","토","금","금","수","수"];
const BRANCH_E= ["수","토","목","목","토","화","화","토","금","금","토","수"];
const ZODIAC  = ["🐭쥐","🐮소","🐯호랑이","🐰토끼","🐲용","🐍뱀","🐴말","🐑양","🐵원숭이","🐔닭","🐶개","🐷돼지"];
const ELEM_KR = {목:"목(木)",화:"화(火)",토:"토(土)",금:"금(金)",수:"수(水)"};
const ELEM_C  = {목:"#2d8a5f",화:"#c1440e",토:"#c8963e",금:"#a89040",수:"#3a7abf"};
const ELEM_EM = {목:"🌿",화:"🔥",토:"🪨",금:"⚡",수:"💧"};
const GEN = {목:"화",화:"토",토:"금",금:"수",수:"목"};  // 상생
const CTL = {목:"토",화:"금",토:"수",금:"목",수:"화"};  // 상극
const GEN_BY = {목:"수",화:"목",토:"화",금:"토",수:"금"}; // 나를 생하는 오행
const CTL_BY = {목:"금",화:"수",토:"목",금:"화",수:"토"}; // 나를 극하는 오행
const MONTH_STEM_BASE = [2,4,6,8,0,2,4,6,8,0]; // 연간별 인월(寅月) 천간 시작점

// ── 만세력 엔진 ─────────────────────────────────────────────
// 절기 기준 월 인덱스 반환 (0=인寅, 1=묘卯, ..., 11=축丑)
function getSajuMonthIdx(year, month, day) {
  // 근사 절기 날짜 [달, 일]
  const JG = [[2,4],[3,6],[4,5],[5,6],[6,6],[7,7],[8,7],[9,8],[10,8],[11,7],[12,7],[1,6]];
  let idx = 11;
  for (let i = 0; i < JG.length; i++) {
    const [jm, jd] = JG[i];
    const jDate = new Date(jm===1 ? year+1 : year, jm-1, jd);
    if (new Date(year, month-1, day) >= jDate) idx = i;
  }
  if (month===1 && day<6) idx = 10; // 소한 이전은 자월
  return idx;
}

function calcSaju(dateStr) {
  const parts = dateStr.split('-').map(Number);
  const [year, month, day] = parts;

  // 1. 연주 (입춘 기준)
  const ipchun = new Date(year, 1, 4); // Feb 4 근사
  const saYear = new Date(year, month-1, day) >= ipchun ? year : year-1;
  const yStemIdx   = ((saYear-4)%10+10)%10;
  const yBranchIdx = ((saYear-4)%12+12)%12;

  // 2. 월주 (절기 기준)
  const mIdx       = getSajuMonthIdx(year, month, day);
  const mStemIdx   = (MONTH_STEM_BASE[yStemIdx] + mIdx) % 10;
  const mBranchIdx = (mIdx + 2) % 12; // 인(2)→묘(3)→...

  // 3. 일주 (60갑자, 기준: 1900-01-31 = 갑자일)
  const REF   = new Date(1900, 0, 31);
  const diff  = Math.round((new Date(year, month-1, day) - REF) / 86400000);
  const dStemIdx   = ((diff%10)+10)%10;
  const dBranchIdx = ((diff%12)+12)%12;

  // 4. 오행 추출
  const YSE = STEM_E[yStemIdx],   YBE = BRANCH_E[yBranchIdx];
  const MSE = STEM_E[mStemIdx],   MBE = BRANCH_E[mBranchIdx];
  const DSE = STEM_E[dStemIdx],   DBE = BRANCH_E[dBranchIdx];

  // 5. 오행 강약 카운트
  const ec = {목:0,화:0,토:0,금:0,수:0};
  [YSE,YBE,MSE,MBE,DSE,DBE].forEach(e=>ec[e]++);
  const sorted = Object.entries(ec).sort((a,b)=>b[1]-a[1]);
  const strongElem = sorted[0][0], weakElem = sorted[sorted.length-1][0];

  // 6. 왕상휴수사 (일간 vs 월지)
  const DE = DSE, ME = MBE;
  let ws, wsScore;
  if      (DE===ME)               { ws="왕(旺)"; wsScore=30; }
  else if (GEN[ME]===DE)          { ws="상(相)"; wsScore=20; }
  else if (GEN[DE]===ME)          { ws="휴(休)"; wsScore=10; }
  else if (CTL[DE]===ME)          { ws="수(囚)"; wsScore=5;  }
  else                             { ws="사(死)"; wsScore=0;  }

  // 7. 십성 분석 (일간 기준)
  const getSS = e => {
    if(e===DE)         return "비겁";
    if(GEN[DE]===e)    return "식상";
    if(CTL[DE]===e)    return "재성";
    if(CTL[e]===DE)    return "관성";
    if(GEN[e]===DE)    return "인성";
    return "비겁";
  };
  const ssc = {비겁:0,식상:0,재성:0,관성:0,인성:0};
  [YSE,YBE,MSE,MBE,DBE].forEach(e=>ssc[getSS(e)]++);
  const domSS = Object.entries(ssc).sort((a,b)=>b[1]-a[1])[0][0];

  // 8. 점수 산출
  const norm = v => Math.min(95, Math.max(40, Math.round(v)));
  const base = 45 + wsScore * 1.5;
  const supCnt = ec[GEN_BY[DE]] + ec[DE];
  const opCnt  = ec[CTL_BY[DE]];
  const adj    = supCnt*3 - opCnt*2;

  const vitality = norm(base + adj + ssc.비겁*4 + ssc.식상*3 - ssc.관성*2);
  const wealth   = norm(base + adj*0.8 + ssc.재성*5 + ssc.인성*2);
  const growth   = norm(base + adj*0.6 + ssc.인성*5 + ssc.식상*3);
  const avg      = Math.round((vitality+wealth+growth)/3);
  const grade    = avg>=80?"대길(大吉)":avg>=65?"중길(中吉)":avg>=50?"소길(小吉)":"주의(注意)";

  return {
    yearPillar:  {stem:STEMS[yStemIdx],  branch:BRANCHES[yBranchIdx],  se:YSE, be:YBE},
    monthPillar: {stem:STEMS[mStemIdx],  branch:BRANCHES[mBranchIdx],  se:MSE, be:MBE},
    dayPillar:   {stem:STEMS[dStemIdx],  branch:BRANCHES[dBranchIdx],  se:DSE, be:DBE},
    zodiac:ZODIAC[yBranchIdx], dayElem:DE, mainElement:ELEM_KR[DE],
    elemCount:ec, strongElem, weakElem,
    wangsang:ws, wsScore, domSS, ssc,
    scores:{vitality,wealth,growth,avg}, grade,
  };
}

// ── 텍스트 풀 ────────────────────────────────────────────────
const TRAIT = {
  목:[
    "창업정신과 성장의 DNA가 강한 기업입니다. 갑목(甲木)처럼 하늘을 향해 뻗어나가는 힘이 이 기업의 가장 큰 자산입니다.",
    "끊임없는 개척과 혁신으로 새로운 시장을 만들어가는 목(木)의 팔자를 타고났습니다. 봄날 새싹이 땅을 뚫고 나오듯 장벽을 부수는 생명력이 넘칩니다.",
    "숲을 이루듯 주변 산업과 생태계를 함께 키워나가는 것이 이 기업의 천명(天命)입니다. 성장과 확장의 기운이 충만합니다.",
  ],
  화:[
    "열정과 혁신으로 세상을 밝히는 화(火)의 기운이 충만합니다. 촛불처럼 주위를 밝히고 따뜻하게 하는 것이 이 기업의 사명입니다.",
    "강렬한 존재감으로 업계에 선명한 발자국을 남기는 기업입니다. 화(火)는 어둠을 밝히듯 이 기업은 시장에 새로운 빛을 가져다줍니다.",
    "불꽃처럼 타오르는 창의성과 실행력이 이 기업의 가장 큰 무기입니다. 남들이 불가능하다고 할 때 가장 빛나는 화(火)의 팔자입니다.",
  ],
  토:[
    "신뢰와 안정이라는 두 기둥 위에 세워진 기업입니다. 대지처럼 모든 것을 품고 기르는 토(土)의 기운이 이 기업의 근본입니다.",
    "시간이 흐를수록 더욱 빛나는 기업입니다. 토(土)는 오래 쌓일수록 비옥해지듯 이 기업의 가치도 세월과 함께 깊어집니다.",
    "묵묵히 자리를 지키며 주변 모든 것의 기반이 되는 기업입니다. 토(土)의 팔자는 화려함보다 깊이로 승부합니다.",
  ],
  금:[
    "날카로운 통찰력과 정밀한 실행력으로 경쟁에서 빛나는 기업입니다. 금(金)은 단단함과 날카로움으로 세상을 변화시킵니다.",
    "원석이 보석이 되듯 끊임없는 연마와 혁신으로 가치를 높여가는 기업입니다. 금(金)의 팔자는 완성도와 품질로 승부합니다.",
    "결단력과 추진력이 탁월한 금(金)의 기운이 넘칩니다. 한번 방향을 정하면 강하게 밀어붙이는 것이 이 기업의 가장 큰 강점입니다.",
  ],
  수:[
    "지혜와 유연함으로 어떤 환경도 극복하는 수(水)의 기운이 이 기업의 본질입니다. 물이 모든 그릇에 담기듯 다양한 시장에 적응합니다.",
    "깊은 통찰과 흐르는 물처럼 자연스러운 전략이 강점인 기업입니다. 수(水)는 막힌 곳을 돌아가는 지혜로 목적지에 반드시 도달합니다.",
    "변화를 두려워하지 않는 수(Water)의 팔자를 타고났습니다. 시대의 흐름을 누구보다 빠르게 읽고 유연하게 대응하는 것이 이 기업의 핵심 경쟁력입니다.",
  ],
};

const WEAKNESS = {
  목:[
    "빠른 성장 이면에 내실이 따라오지 못하는 함정을 조심하십시오. 나무는 뿌리가 깊어야 높이 자랄 수 있습니다.",
    "확장 본능이 강한 만큼 선택과 집중의 지혜가 필요합니다. 가지가 너무 많으면 줄기가 약해집니다.",
    "새로운 것을 추구하다 기존의 것을 잃을 수 있습니다. 혁신과 안정의 균형을 잃지 마십시오.",
  ],
  화:[
    "뜨거운 열정이 과열로 이어지지 않도록 주의하십시오. 불은 통제를 잃으면 모든 것을 태웁니다.",
    "빠른 추진력이 때로는 주변과의 마찰을 만듭니다. 속도만큼 소통과 공감을 중시하십시오.",
    "강렬한 존재감이 오히려 독이 될 수 있습니다. 주목받는 것과 지속 가능한 것의 차이를 아는 지혜가 필요합니다.",
  ],
  토:[
    "안정을 추구하다 변화의 기회를 놓칠 수 있습니다. 대지도 때로는 뒤집어져야 새것이 자랍니다.",
    "신중함이 우유부단함이 되지 않도록 주의하십시오. 결정의 때를 놓치면 기회도 사라집니다.",
    "보수적 성향이 혁신을 가로막을 수 있습니다. 안정과 변화를 함께 추구하는 균형이 필요합니다.",
  ],
  금:[
    "날카로움이 유연함을 잃으면 쉽게 부러집니다. 원칙과 함께 상황에 맞는 융통성을 갖추십시오.",
    "완벽을 추구하다 속도를 잃을 수 있습니다. 때로는 80%의 완성도로 빠르게 실행하는 것이 더 나을 수 있습니다.",
    "냉철한 판단이 사람의 마음을 놓칠 수 있습니다. 숫자와 논리 너머 인간적 신뢰를 쌓는 것이 장기 성공의 열쇠입니다.",
  ],
  수:[
    "유연함이 지나치면 방향을 잃습니다. 물도 강둑이 있어야 흐를 수 있습니다.",
    "변화에 빠르게 적응하는 것이 오히려 정체성을 흔들 수 있습니다. 흔들리지 않는 핵심 가치를 지키십시오.",
    "너무 많은 가능성을 좇다 정작 중요한 것을 놓칠 수 있습니다. 집중이 분산보다 강합니다.",
  ],
};

const SIBSEONG_TEXT = {
  비겁:"강한 자립심과 경쟁 본능이 주 에너지원입니다. 독자적 기술과 내부 역량으로 승부하는 기업입니다.",
  식상:"창의성과 표현력이 핵심 경쟁력입니다. 제품/서비스 혁신과 마케팅에서 업계를 선도합니다.",
  재성:"수익 창출 능력과 재무 관리가 탁월합니다. 비즈니스 감각이 뛰어나 현금흐름을 잘 관리합니다.",
  관성:"브랜드 신뢰와 대외 평판이 최대 자산입니다. 규정과 거버넌스를 중시하는 안정적 경영 구조입니다.",
  인성:"기술력과 지식 자산이 핵심 경쟁력입니다. R&D와 특허, 노하우 축적으로 장기 경쟁우위를 만듭니다.",
};

const WANGSANG_TEXT = {
  "왕(旺)":"일간과 월지의 오행이 동기(同氣)를 이루어 기운이 왕성합니다. 주어진 환경과 기업 기질이 완벽히 맞아떨어지는 최상의 조합입니다.",
  "상(相)":"월지가 일간을 생하여 외부 환경이 기업 에너지를 키워줍니다. 시장 흐름을 타고 성장하기 좋은 기운입니다.",
  "휴(休)":"일간이 월지를 생하는 구조로 에너지를 나눠주는 형상입니다. 안정적이나 소진에 주의가 필요합니다.",
  "수(囚)":"일간이 월지를 극하는 구조로 기운의 마찰이 있습니다. 환경과의 긴장감 속에서 실력을 발휘하는 유형입니다.",
  "사(死)":"월지가 일간을 극하는 구조입니다. 외부 환경의 압박이 있으나 이를 극복할 때 더욱 강해지는 팔자입니다.",
};

// 기간별 운세 텍스트 풀
const PERIOD_POOL = {
  daily:{
    great:[
      "금(金)의 결단 기운이 강한 하루입니다. 오래 미뤄온 중요한 결정을 내리기에 최적의 날입니다.",
      "목(木)의 생기가 넘치는 하루입니다. 새로운 시도와 제안이 긍정적인 반응을 얻습니다.",
      "수(水)의 지혜로운 기운이 감도는 날입니다. 복잡한 문제의 해법이 명확하게 보입니다.",
      "오늘은 귀인의 기운이 함께합니다. 예상치 못한 곳에서 좋은 인연과 기회가 찾아옵니다.",
      "화(火)의 기운이 활활 타오르는 날입니다. 열정적인 추진이 주변의 공감을 이끌어냅니다.",
      "오행의 기운이 고르게 펼쳐진 날입니다. 어떤 방향으로 나아가도 막힘이 없습니다.",
      "토(土)와 목(木)이 조화를 이루는 날입니다. 안정 속에서 새로운 성장의 씨앗이 싹틉니다.",
      "오늘은 대외 활동에 특히 유리한 기운이 흐릅니다. 미팅과 협상에서 좋은 결과가 납니다.",
    ],
    normal:[
      "오늘은 무리한 변화보다 현상 유지가 유리합니다. 내부 점검과 정비에 집중하세요.",
      "기운의 흐름이 고요한 날입니다. 실행보다 계획과 준비에 집중하면 됩니다.",
      "토(土)의 묵직한 기운이 감도는 날입니다. 빠른 결과를 기대하기보다 꾸준함을 유지하세요.",
      "평온한 기운의 하루입니다. 주변과의 관계를 돌아보고 소통을 강화하기 좋은 날입니다.",
      "금(金)과 목(木)의 기운이 균형을 이루는 날입니다. 공격과 수비를 적절히 조율하세요.",
      "오늘은 큰 움직임보다 세밀한 관리가 필요합니다. 디테일에 집중하면 좋은 결과가 옵니다.",
      "수(Water)의 흐름이 잔잔한 날입니다. 새로운 도전보다 기존 업무 완성에 주력하세요.",
      "기운이 평탄하게 흐르는 날입니다. 무리하지 않으면 안정적인 하루가 됩니다.",
    ],
    caution:[
      "오늘은 외부 기운과 마찰이 예상됩니다. 신중한 하루가 필요합니다.",
      "상극의 기운이 감지됩니다. 무리한 추진보다는 준비에 집중하세요.",
      "기운이 소진되는 날입니다. 에너지 관리와 불필요한 소모를 줄이세요.",
      "화(火)와 수(Water)가 충돌하는 기운이 감지됩니다. 내부 갈등 관리에 각별히 유의하세요.",
      "오늘은 새로운 시작을 피하는 것이 좋습니다. 기존 업무 마무리에 집중하세요.",
      "기운의 흐름이 막혀있는 날입니다. 강하게 밀어붙이면 오히려 역효과가 납니다.",
      "금(金)의 날카로운 기운이 내부를 향하는 날입니다. 내부 마찰과 오해에 주의하세요.",
      "오늘은 핵심 업무에만 집중하고 불필요한 리스크를 피하세요.",
    ],
  },
  weekly:{
    great:[
      "이번 주는 상생의 기운이 강합니다. 협업과 파트너십에서 좋은 소식이 옵니다.",
      "목(木)과 화(火)가 조화를 이루는 주간입니다. 성장 동력이 다시 살아납니다.",
      "이번 주 금(金)의 기운이 절정입니다. 결단력 있는 실행이 빛을 발합니다.",
      "이번 주는 귀인의 기운이 강합니다. 중요한 미팅과 협상에서 예상 이상의 성과가 납니다.",
      "화(火)의 기운이 상승하는 주간입니다. 새로운 프로젝트를 시작하기에 최적의 타이밍입니다.",
      "이번 주는 대외 활동이 특히 유리합니다. 외부 소통에서 새로운 기회를 발굴하세요.",
      "목(木)의 뻗어나가는 기운이 강한 주간입니다. 확장과 개척에 나서기 좋은 시기입니다.",
      "이번 주는 오행의 기운이 고르게 펼쳐집니다. 다양한 시도가 모두 좋은 결과를 만듭니다.",
    ],
    normal:[
      "이번 주는 기운의 흐름이 평탄합니다. 큰 변화보다 꾸준함이 중요한 시기입니다.",
      "수(Water)의 흐름이 잔잔한 주간입니다. 내실을 다지는 데 집중하세요.",
      "토(土)의 기운이 감도는 주간입니다. 안정적인 운영이 최선입니다.",
      "이번 주는 내부 소통을 강화하기 좋은 시기입니다. 팀 역량을 결집하면 성과가 배가됩니다.",
      "이번 주는 큰 결과보다 작은 성취들이 쌓이는 시기입니다. 과정에 충실하면 됩니다.",
      "평온한 기운의 주간입니다. 관계 관리와 네트워킹에 시간을 투자하기 좋습니다.",
      "이번 주는 새로운 것보다 기존 업무의 완성도를 높이는 데 집중하세요.",
      "기운의 균형이 유지되는 주간입니다. 무리하지 않으면 안정적인 한 주가 됩니다.",
    ],
    caution:[
      "이번 주는 상극의 기운이 일부 작용합니다. 중요한 계약이나 발표는 다음 주로 미루세요.",
      "기운의 변동이 큰 주간입니다. 리스크 관리에 신경 쓰세요.",
      "화(Fire)의 과잉 기운이 우려됩니다. 과도한 확장을 자제하세요.",
      "이번 주는 예상치 못한 변수가 생길 수 있습니다. 여유 자원을 확보해두세요.",
      "이번 주는 새로운 투자나 확장보다 기존 자원 관리에 집중하는 것이 안전합니다.",
      "수(Water)의 기운이 과하게 흘러 방향을 잃을 수 있는 주간입니다. 핵심에 집중하세요.",
      "이번 주는 에너지 소진이 우려됩니다. 불필요한 업무를 줄이고 핵심에 역량을 집중하세요.",
      "토(土)와 목(木)의 충돌 기운이 감지됩니다. 안정과 성장 사이에서 균형을 잃지 마세요.",
    ],
  },
  monthly:{
    great:[
      "이달은 기업 오행과 월의 기운이 상생합니다. 새로운 사업 기회를 적극 모색하세요.",
      "목(木)의 성장 기운이 최고조에 달하는 달입니다. 확장 전략이 효과를 냅니다.",
      "수(Water)와 금(金)이 조화를 이루는 달입니다. 재무적 성과가 기대됩니다.",
      "이달은 대외 신뢰도가 높아지는 시기입니다. 파트너십과 계약에서 좋은 소식이 옵니다.",
      "화(火)의 기운이 절정에 달하는 달입니다. 오랫동안 준비해온 전략이 빛을 발합니다.",
      "이달은 인재 영입과 조직 강화에 최적의 시기입니다. 핵심 역량을 키우세요.",
      "이달은 브랜드 가치와 대외 신뢰도가 크게 상승하는 달입니다.",
      "수(Water)의 지혜로운 기운이 넘치는 달입니다. 복잡한 경쟁 환경을 현명하게 헤쳐나갑니다.",
    ],
    normal:[
      "이달은 기운의 흐름이 안정적입니다. 현재 전략을 유지하는 것이 최선입니다.",
      "토(土)의 안정 기운이 감도는 달입니다. 내부 역량 강화에 집중하세요.",
      "평온한 기운의 달입니다. 준비와 전략 수립에 좋은 시기입니다.",
      "이달은 현상 유지와 내부 강화에 집중하기 좋은 시기입니다. 다음 도약을 위한 준비를 하세요.",
      "이달은 고객 관계와 브랜드 신뢰를 강화하기 좋은 기운이 흐릅니다.",
      "기운이 평온하게 흐르는 달입니다. 무리하지 않으면 안정적인 실적을 거둘 수 있습니다.",
      "이달은 내부 프로세스를 정비하고 효율을 높이는 데 집중하기 좋은 시기입니다.",
      "이달은 성과보다 과정에 집중하기 좋은 달입니다. 체계와 시스템을 정비하세요.",
    ],
    caution:[
      "이달은 기운의 소진이 우려됩니다. 무리한 투자나 확장을 자제하세요.",
      "상극의 기운이 일부 작용하는 달입니다. 리스크 분산이 중요합니다.",
      "화(Fire)의 기운이 약한 달입니다. 추진력이 떨어질 수 있으니 팀워크로 보완하세요.",
      "이달은 예상치 못한 외부 변수에 주의가 필요합니다. 비상 계획을 점검해두세요.",
      "이달은 새로운 시작보다 기존 업무의 마무리에 집중하는 것이 유리합니다.",
      "이달은 에너지 관리가 매우 중요합니다. 불필요한 곳에 자원을 낭비하지 않도록 주의하세요.",
      "토(土)의 과잉 기운이 변화를 막는 달입니다. 혁신보다 안정에 집중하는 것이 현명합니다.",
      "이달은 대외 활동보다 내부 점검에 집중하는 것이 유리합니다.",
    ],
  },
  quarterly:{
    great:[
      "이번 분기는 강한 상생의 기운이 작용합니다. 실적 개선과 성장이 기대되는 시기입니다.",
      "금(金)과 수(Water)가 조화를 이루는 분기입니다. 전략적 투자가 결실을 맺습니다.",
      "목(木)의 성장 기운이 지속되는 분기입니다. 신규 사업의 발판을 다지기 좋습니다.",
      "이번 분기는 대외 신뢰도가 높아지는 시기입니다. 파트너십과 계약에서 좋은 소식이 옵니다.",
      "화(Fire)의 기운이 절정에 달하는 분기입니다. 오랫동안 준비해온 전략이 본격적으로 빛을 발합니다.",
      "이번 분기는 시장 점유율을 확대하기 좋은 기운이 흐릅니다. 공격적인 마케팅이 효과를 냅니다.",
      "이번 분기는 그간의 노력이 구체적인 성과로 나타나는 시기입니다. 자신 있게 나아가세요.",
      "이번 분기는 인재 영입과 조직 강화에 최적의 시기입니다.",
    ],
    normal:[
      "이번 분기는 기운의 흐름이 평탄합니다. 내실 경영이 최선의 전략입니다.",
      "토(土)의 안정 기운이 감도는 분기입니다. 꾸준한 실행력이 중요합니다.",
      "기운의 균형이 맞는 분기입니다. 현재 방향을 유지하면 좋은 결과가 옵니다.",
      "이번 분기는 현상 유지와 점진적 개선에 집중하기 좋은 분기입니다.",
      "이번 분기는 고객 관계와 브랜드 신뢰를 강화하기 좋은 기운이 흐릅니다.",
      "기운이 평온하게 흐르는 분기입니다. 무리하지 않으면 안정적인 실적을 거둘 수 있습니다.",
      "이번 분기는 내부 프로세스를 정비하고 효율을 높이는 데 집중하기 좋은 시기입니다.",
      "이번 분기는 리스크를 최소화하면서 안정적인 성과를 내는 것이 최선입니다.",
    ],
    caution:[
      "이번 분기는 기운의 마찰이 예상됩니다. 보수적인 경영 전략이 필요한 시기입니다.",
      "수(Water)의 기운이 과한 분기입니다. 우선순위를 명확히 하고 집중하세요.",
      "변동성이 큰 분기입니다. 리스크 헤지를 강화하세요.",
      "이번 분기는 외부 환경의 불확실성이 높습니다. 현금 유동성 확보를 최우선으로 하세요.",
      "이번 분기는 새로운 투자보다 기존 자산 관리에 집중하는 것이 안전합니다.",
      "화(Fire)의 기운이 과하게 작용하는 분기입니다. 과열을 식히고 냉철한 판단력을 유지하세요.",
      "이번 분기는 대외 관계에서 예상치 못한 변수가 생길 수 있습니다. 계약서 검토를 꼼꼼히 하세요.",
      "이번 분기는 큰 결정보다 작고 확실한 성과에 집중하는 것이 유리합니다.",
    ],
  },
  yearly:{
    great:[
      "올해는 기업의 오행이 연도의 기운과 대길(大吉)의 상생을 이룹니다. 도약의 해가 될 것입니다.",
      "금(金)의 결실 기운이 충만한 해입니다. 그간의 노력이 빛을 발하는 한 해입니다.",
      "목(木)의 성장 기운이 넘치는 해입니다. 새로운 시장과 사업 기회가 열립니다.",
      "올해는 기업 역사에 중요한 전환점이 될 가능성이 큽니다. 담대하게 나아가세요.",
      "화(Fire)의 기운이 한 해 내내 강하게 작용합니다. 혁신과 변화를 두려워하지 마세요.",
      "올해는 브랜드 가치와 대외 신뢰도가 크게 상승하는 해입니다.",
      "수(Water)와 목(木)이 상생하는 해입니다. 지혜로운 판단이 탁월한 성장으로 이어집니다.",
      "올해는 파트너십과 협업에서 큰 성과가 나오는 해입니다. 혼자보다 함께 나아가세요.",
    ],
    normal:[
      "올해는 기운의 흐름이 안정적입니다. 무리한 확장보다 내실을 다지는 해입니다.",
      "토(土)의 안정 기운이 감도는 한 해입니다. 기반을 다지는 것이 장기적으로 유리합니다.",
      "평온한 운세의 해입니다. 꾸준한 실행이 쌓여 내년의 도약을 준비합니다.",
      "올해는 현상 유지와 점진적 개선에 집중하기 좋은 해입니다.",
      "수(Water)의 흐름이 잔잔한 한 해입니다. 급격한 변화보다 꾸준한 발전이 더 큰 성과를 냅니다.",
      "올해는 내부 역량을 강화하고 조직 체계를 정비하기 좋은 시기입니다.",
      "올해는 브랜드 신뢰와 고객 관계를 강화하기 좋은 기운이 흐릅니다.",
      "올해는 실력을 쌓고 다음 도약을 준비하는 해입니다. 지금의 노력이 내년에 빛을 발합니다.",
    ],
    caution:[
      "올해는 기운의 소진이 우려됩니다. 보수적인 전략과 내부 역량 강화가 필요한 해입니다.",
      "상극의 기운이 작용하는 한 해입니다. 리스크 관리를 최우선으로 하세요.",
      "변화와 도전이 많은 해입니다. 유연한 대응 능력이 생존의 핵심입니다.",
      "올해는 외부 환경의 변화가 예상보다 클 수 있습니다. 다양한 시나리오를 준비해두세요.",
      "올해는 공격보다 수비가 더 중요한 해입니다. 핵심 자산을 지키는 데 집중하세요.",
      "화(Fire)의 과잉 기운이 우려되는 해입니다. 감정적 결정을 피하고 데이터 기반 경영을 강화하세요.",
      "올해는 새로운 투자보다 기존 사업의 효율을 높이는 것이 현명한 전략입니다.",
      "올해는 인내와 신중함이 최고의 덕목입니다. 지금의 어려움을 잘 헤쳐나가면 내년에 반드시 기회가 옵니다.",
    ],
  },
};

function getPeriodFortune(founded, period) {
  const d = new Date(founded);
  const base = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
  const now = new Date();
  let seed;
  switch(period) {
    case "daily":     seed=(base+now.getFullYear()*1000+now.getMonth()*31+now.getDate())%100; break;
    case "weekly":    seed=(base+now.getFullYear()*100+now.getMonth()*4+Math.ceil(now.getDate()/7))%100; break;
    case "monthly":   seed=(base+now.getFullYear()*100+now.getMonth())%100; break;
    case "quarterly": seed=(base+now.getFullYear()*10+Math.ceil((now.getMonth()+1)/3))%100; break;
    default:          seed=(base+now.getFullYear())%100;
  }
  const s=Math.abs(seed);
  const gradeKey = s>=60?"great":s>=30?"normal":"caution";
  const pool = PERIOD_POOL[period][gradeKey];
  const text = pool[s % pool.length];
  const gradeLabel = gradeKey==="great"?"대길(大吉)":gradeKey==="normal"?"중길(中吉)":"주의(注意)";
  const gradeColor = gradeKey==="great"?"#4ade80":gradeKey==="normal"?"#c8963e":"#ef4444";
  const score = gradeKey==="great" ? 75+(s%20) : gradeKey==="normal" ? 55+(s%20) : 40+(s%18);
  return {text, gradeLabel, gradeColor, score};
}

function getNextUpdate(period) {
  const now = new Date();
  switch(period) {
    case "daily": {
      const h=23-now.getHours(), m=59-now.getMinutes();
      return `${h}시간 ${m}분 후 업데이트`;
    }
    case "weekly":  return `${7-now.getDay()}일 후 업데이트`;
    case "monthly": return `다음달 1일 업데이트`;
    case "quarterly": return `다음 분기 업데이트`;
    default: return `${now.getFullYear()+1}년 1월 업데이트`;
  }
}

function getPeriodLabel(period) {
  const n=new Date();
  switch(period) {
    case "daily":     return `${n.getMonth()+1}월 ${n.getDate()}일`;
    case "weekly":    return `${n.getMonth()+1}월 ${Math.ceil(n.getDate()/7)}주차`;
    case "monthly":   return `${n.getFullYear()}년 ${n.getMonth()+1}월`;
    case "quarterly": return `${n.getFullYear()}년 ${Math.ceil((n.getMonth()+1)/3)}분기`;
    default:          return `${n.getFullYear()}년`;
  }
}

// ── 투자자 궁합 ──────────────────────────────────────────────
const COMPAT_INVESTOR_TYPE = {
  목:{type:"성장추구형",desc:"트렌드를 빠르게 읽고 성장 가능성에 베팅합니다. 신산업과 스타트업에 끌립니다."},
  화:{type:"열정돌진형",desc:"확신이 서면 과감하게 집중 투자합니다. 모멘텀 투자에 강합니다."},
  토:{type:"가치안정형",desc:"내실 있는 기업을 장기 보유합니다. 배당과 안정성을 중시합니다."},
  금:{type:"분석정밀형",desc:"철저한 분석 후 냉철하게 결정합니다. 퀀트·데이터 기반 투자에 적합합니다."},
  수:{type:"유연적응형",desc:"시장 흐름을 읽고 유연하게 대응합니다. 다양한 전략을 구사합니다."},
};

function getCompat(invElem, corpElem) {
  let score, relation, labelTag, desc, advice, role;
  if(invElem===corpElem){
    score=78;relation="비화(比和)";labelTag="동류 인연";
    desc=`투자자와 기업이 같은 ${ELEM_KR[invElem]} 기운을 지녔습니다. 서로를 잘 이해하지만 경쟁 관계가 될 수도 있습니다.`;
    advice="서로의 강점을 인정하고 시너지를 만든다면 안정적인 인연입니다.";role="동반자형";
  }else if(GEN[invElem]===corpElem){
    score=88;relation="상생(相生)";labelTag="나→기업 상생";
    desc=`투자자의 ${ELEM_KR[invElem]} 기운이 기업의 ${ELEM_KR[corpElem]} 기운을 북돋아 줍니다.`;
    advice="장기 보유에 적합한 인연입니다. 기업이 성장할수록 함께 빛납니다.";role="후원자형";
  }else if(GEN[corpElem]===invElem){
    score=92;relation="상생(相生)";labelTag="기업→나 상생";
    desc=`기업의 ${ELEM_KR[corpElem]} 기운이 투자자의 ${ELEM_KR[invElem]} 기운을 키워줍니다.`;
    advice="이 기업은 투자자에게 이로운 기운을 줍니다. 인연이 깊습니다.";role="수혜자형";
  }else if(CTL[invElem]===corpElem){
    score=52;relation="상극(相克)";labelTag="나→기업 상극";
    desc=`투자자의 ${ELEM_KR[invElem]} 기운이 기업의 ${ELEM_KR[corpElem]} 기운을 억제합니다.`;
    advice="단기 트레이딩보다는 신중한 접근이 필요합니다.";role="도전자형";
  }else{
    score=45;relation="상극(相克)";labelTag="기업→나 상극";
    desc=`기업의 ${ELEM_KR[corpElem]} 기운이 투자자의 ${ELEM_KR[invElem]} 기운을 억누릅니다.`;
    advice="분산 투자로 위험을 줄이는 것이 현명합니다.";role="역행자형";
  }
  const cGrade=score>=88?"천생연분(天生緣分)":score>=78?"좋은인연(好緣)":score>=60?"평범인연(平緣)":"주의인연(注意緣)";
  const cColor=score>=88?"#4ade80":score>=78?"#60a5fa":score>=60?"#c8963e":"#ef4444";
  return {score,relation,labelTag,desc,advice,role,cGrade,cColor};
}

// ── DART 전체 상장기업 목록 (public/corpList.json에서 로드) ──
let _corpListCache = null;
async function loadCorpList() {
  if (_corpListCache) return _corpListCache;
  const res = await fetch('/corpList.json');
  const data = await res.json();
  _corpListCache = data;
  return data;
}

// 인기 기업 빠른 선택용 (고유번호만 있으면 되고, 상세정보는 클릭 시 API로 조회)
const POPULAR_CORPS = [
  {corpCode:"00126380",name:"삼성전자",ticker:"005930"},
  {corpCode:"00164779",name:"SK하이닉스",ticker:"000660"},
  {corpCode:"00258801",name:"카카오",ticker:"035720"},
  {corpCode:"00164742",name:"현대자동차",ticker:"005380"},
  {corpCode:"00266961",name:"네이버",ticker:"035420"},
  {corpCode:"00401731",name:"LG전자",ticker:"066570"},
  {corpCode:"00155319",name:"POSCO홀딩스",ticker:"005490"},
  {corpCode:"00413046",name:"셀트리온",ticker:"068270"},
];


function searchDart(list, q) {
  if (!q || q.length < 1) return [];
  const lq = q.trim().toLowerCase();
  return list
    .filter(c => c.name.toLowerCase().includes(lq) || c.ticker.toLowerCase().includes(lq))
    .slice(0, 8);
}

// 선택한 기업의 상세정보(설립일 등)를 백엔드(api/search.js)로 조회
async function fetchCorpDetail(corpCode) {
  const res = await fetch(`/api/search?corpCode=${corpCode}`);
  if (!res.ok) throw new Error('조회 실패');
  return res.json();
}


// ── 광고 컴포넌트 ────────────────────────────────────────────
const ADS=[
  {logo:"🏦",brand:"키움증권",title:"비대면 계좌개설 이벤트",desc:"지금 개설하면 인기 주식 1주 증정! 30초 완료",cta:"계좌 개설하기 →",bg:"#1a4080"},
  {logo:"📊",brand:"미래에셋증권",title:"AI 투자분석 서비스",desc:"팔자가 대길이라면 지금이 투자 시작 타이밍!",cta:"무료로 시작하기 →",bg:"#1a3050"},
  {logo:"💰",brand:"토스증권",title:"수수료 0원 이벤트",desc:"국내외 주식 거래 수수료 완전 무료",cta:"토스증권 바로가기 →",bg:"#0a3060"},
  {logo:"📈",brand:"삼성증권",title:"CMA 연 4.2% 특별금리",desc:"지금 가입 시 3개월 특별 금리 제공",cta:"지금 가입하기 →",bg:"#1a2040"},
];

function ResultAd({corpName}){
  const [closed,setClosed]=useState(false);
  const ad=ADS[Math.abs((corpName?.charCodeAt(0)||0))%ADS.length];
  if(closed)return null;
  return(
    <div style={{background:`linear-gradient(135deg,${ad.bg},#0d1220)`,border:"1px solid #2a4060",borderRadius:14,padding:16,margin:"16px 0",position:"relative"}}>
      <button onClick={()=>setClosed(true)} style={{position:"absolute",top:8,right:10,background:"none",border:"none",color:"#4a5568",fontSize:16,cursor:"pointer"}}>×</button>
      <div style={{fontSize:10,color:"#4a5568",marginBottom:10,letterSpacing:1}}>SPONSORED · 광고</div>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
        <div style={{width:48,height:48,background:"#1e3050",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{ad.logo}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:3}}>{ad.brand} · {ad.title}</div>
          <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.5}}>{ad.desc}</div>
        </div>
      </div>
      <button style={{width:"100%",background:`linear-gradient(90deg,${ad.bg},#2060c0)`,color:"#fff",border:"none",borderRadius:10,padding:"10px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{ad.cta}</button>
      <div style={{fontSize:10,color:"#374151",textAlign:"center",marginTop:6}}>본 광고는 제휴 광고입니다</div>
    </div>
  );
}
function InFeedAd(){
  const ad=ADS[new Date().getDate()%ADS.length];
  return(
    <div style={{background:"#0d1220",border:"1px dashed #1e3050",borderRadius:12,padding:"11px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:38,height:38,background:"#1e2740",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{ad.logo}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:10,color:"#374151",marginBottom:2}}>광고 · {ad.brand}</div>
        <div style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>{ad.title}</div>
        <div style={{fontSize:11,color:"#4a5568"}}>{ad.desc}</div>
      </div>
      <div style={{fontSize:11,color:"#4a5568",flexShrink:0}}>바로가기 →</div>
    </div>
  );
}
function BannerAd(){
  const [closed,setClosed]=useState(false);
  const ad=ADS[new Date().getMonth()%ADS.length];
  if(closed)return null;
  return(
    <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:10,padding:"10px 14px",margin:"14px 0",display:"flex",alignItems:"center",gap:10,position:"relative"}}>
      <div style={{fontSize:22,flexShrink:0}}>{ad.logo}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:10,color:"#374151",marginBottom:1}}>광고 · Google AdSense</div>
        <div style={{fontSize:13,fontWeight:700,color:"#94a3b8"}}>{ad.brand} — {ad.title}</div>
        <div style={{fontSize:11,color:"#4a5568"}}>{ad.cta}</div>
      </div>
      <button onClick={()=>setClosed(true)} style={{background:"none",border:"none",color:"#4a5568",fontSize:16,cursor:"pointer",padding:"0 4px",flexShrink:0}}>×</button>
    </div>
  );
}

// ── UI 공통 컴포넌트 ─────────────────────────────────────────
function ScoreBar({label,value,color}){
  const [w,setW]=useState(0);
  useEffect(()=>{setTimeout(()=>setW(value),200);},[value]);
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:13,color:"#94a3b8"}}>{label}</span>
        <span style={{fontSize:13,fontWeight:800,color}}>{value}</span>
      </div>
      <div style={{background:"#1e2740",borderRadius:6,height:8,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${w}%`,background:color,borderRadius:6,transition:"width 1s cubic-bezier(.4,0,.2,1)"}}/>
      </div>
    </div>
  );
}

function PillarCard({label,pillar,color}){
  return(
    <div style={{flex:1,background:"#111827",border:`1px solid ${color}44`,borderRadius:12,padding:"10px 6px",textAlign:"center"}}>
      <div style={{fontSize:9,color:"#64748b",marginBottom:5,letterSpacing:1}}>{label}</div>
      <div style={{fontSize:15,fontWeight:900,color}}>{pillar.stem.split("(")[0]}</div>
      <div style={{fontSize:9,color:ELEM_C[pillar.se]||"#888",marginBottom:4}}>{ELEM_EM[pillar.se]}{pillar.se}</div>
      <div style={{width:1,height:12,background:color+"44",margin:"0 auto 4px"}}/>
      <div style={{fontSize:15,fontWeight:900,color:color+"cc"}}>{pillar.branch.split("(")[0]}</div>
      <div style={{fontSize:9,color:ELEM_C[pillar.be]||"#888"}}>{ELEM_EM[pillar.be]}{pillar.be}</div>
    </div>
  );
}

function CompatGauge({score,color}){
  const [a,setA]=useState(0);
  useEffect(()=>{setTimeout(()=>setA(score),300);},[score]);
  const r=54,cx=70,cy=70,c2=2*Math.PI*r,d=(a/100)*c2;
  return(
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2740" strokeWidth="10"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${d} ${c2}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{transition:"stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)"}}/>
      <text x={cx} y={cy-6} textAnchor="middle" fill={color} fontSize="26" fontWeight="900" fontFamily="inherit">{a}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="inherit">인연지수</text>
    </svg>
  );
}

function CorpSearch({onSelect,placeholder="기업명 또는 티커 검색"}){
  const [q,setQ]=useState("");
  const [results,setResults]=useState([]);
  const [focused,setFocused]=useState(false);
  const [corpList,setCorpList]=useState([]);
  const [picking,setPicking]=useState(false);

  useEffect(()=>{ loadCorpList().then(setCorpList).catch(()=>{}); },[]);
  useEffect(()=>{setResults(q.length>=1?searchDart(corpList,q):[]);},[q,corpList]);

  const pick=async(c)=>{
    setQ(c.name);setResults([]);setFocused(false);
    setPicking(true);
    try{
      const detail = await fetchCorpDetail(c.corpCode);
      onSelect({
        corpCode: c.corpCode,
        name: detail.name || c.name,
        ticker: detail.ticker || c.ticker,
        founded: detail.founded,
        ceo: detail.ceo,
        sector: "-",
      });
    }catch(e){
      onSelect({ corpCode:c.corpCode, name:c.name, ticker:c.ticker, founded:null, ceo:"-", sector:"-" });
    }
    setPicking(false);
  };

  return(
    <div style={{position:"relative"}}>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16}}>{picking?"⏳":"🔍"}</span>
        <input style={{width:"100%",background:"#111827",border:`1px solid ${focused?"#c8963e":"#1e2740"}`,borderRadius:10,padding:"11px 14px 11px 38px",color:"#e2e8f0",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.2s"}}
          placeholder={corpList.length? placeholder : "기업 목록 불러오는 중..."} value={q}
          disabled={picking}
          onChange={e=>setQ(e.target.value)}
          onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),200)}/>
        {q&&<button onClick={()=>{setQ("");setResults([]);}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",fontSize:18,cursor:"pointer"}}>×</button>}
      </div>
      {results.length>0&&focused&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#111827",border:"1px solid #1e2740",borderRadius:10,overflow:"hidden",zIndex:50,boxShadow:"0 8px 24px #00000088",maxHeight:320,overflowY:"auto"}}>
          {results.map((c,i)=>(
            <button key={i} onMouseDown={()=>pick(c)}
              style={{width:"100%",background:"none",border:"none",borderBottom:i<results.length-1?"1px solid #1e2740":"none",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <div style={{width:34,height:34,background:"#1e2740",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#64748b",flexShrink:0}}>🏢</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0"}}>{c.name}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{c.ticker}</div>
              </div>
            </button>
          ))}
          <div style={{padding:"5px 14px",background:"#0d1220",borderTop:"1px solid #1e2740"}}>
            <div style={{fontSize:10,color:"#374151"}}>📡 DART 전체 상장기업 {corpList.length}개</div>
          </div>
        </div>
      )}
      {q.length>=1&&results.length===0&&focused&&corpList.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#111827",border:"1px solid #1e2740",borderRadius:10,padding:14,textAlign:"center",zIndex:50}}>
          <div style={{fontSize:13,color:"#64748b"}}>검색 결과가 없습니다</div>
        </div>
      )}
    </div>
  );
}

const MAIN_TABS=["분석","기간운세","투자자궁합","히스토리"];
const PERIOD_TABS=[{id:"daily",icon:"☀️",label:"일간"},{id:"weekly",icon:"📅",label:"주간"},{id:"monthly",icon:"🌙",label:"월간"},{id:"quarterly",icon:"📊",label:"분기"},{id:"yearly",icon:"🎯",label:"연간"}];
const INIT_HISTORY=[{name:"삼성전자",ticker:"005930",date:"2024-12-10",grade:"대길(大吉)",dayElem:"화"},{name:"카카오",ticker:"035720",date:"2025-01-04",grade:"중길(中吉)",dayElem:"목"}];
const LOADING_MSGS=["DART 공시 데이터를 불러오는 중...","만세력으로 사주를 정렬하는 중...","왕상휴수사를 계산하는 중...","팔자를 풀이하는 중..."];
const COMPAT_MSGS=["투자자의 생년월일을 분석하는 중...","기업의 팔자를 펼치는 중...","오행 상생·상극을 대조하는 중...","인연 지수를 산출하는 중..."];

export default function App(){
  const [tab,setTab]=useState("분석");
  const [pTab,setPTab]=useState("daily");
  const [corp,setCorp]=useState(null);
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [lstep,setLstep]=useState(0);
  const [history,setHistory]=useState(INIT_HISTORY);
  const [invName,setInvName]=useState("");
  const [invBirth,setInvBirth]=useState("");
  const [cCorp,setCCorp]=useState(null);
  const [cResult,setCResult]=useState(null);
  const [cLoading,setCLoading]=useState(false);
  const [cStep,setCStep]=useState(0);

  const ec=e=>ELEM_C[e]||"#888";

  const analyze=()=>{
    if(!corp)return;
    setResult(null);setLoading(true);setLstep(0);
    let s=0;
    const iv=setInterval(()=>{
      s++;setLstep(s);
      if(s>=LOADING_MSGS.length){
        clearInterval(iv);
        setTimeout(()=>{
          const saju=calcSaju(corp.founded);
          const traitIdx=parseInt(corp.founded.split("-")[2])%3;
          setResult({saju,corp,traitIdx});
          setHistory(p=>[{name:corp.name,ticker:corp.ticker,date:new Date().toISOString().slice(0,10),grade:saju.grade,dayElem:saju.dayElem},...p.slice(0,9)]);
          setLoading(false);
        },400);
      }
    },650);
  };

  const calcCompat=()=>{
    if(!invBirth||!cCorp)return;
    setCResult(null);setCLoading(true);setCStep(0);
    let s=0;
    const iv=setInterval(()=>{
      s++;setCStep(s);
      if(s>=COMPAT_MSGS.length){
        clearInterval(iv);
        setTimeout(()=>{
          const invSaju=calcSaju(invBirth);
          const corSaju=calcSaju(cCorp.founded);
          const compat=getCompat(invSaju.dayElem,corSaju.dayElem);
          setCResult({invSaju,corSaju,compat,invName:invName||"투자자",corpName:cCorp.name,invType:COMPAT_INVESTOR_TYPE[invSaju.dayElem]});
          setCLoading(false);
        },400);
      }
    },650);
  };

  const pickPopular = async (c, target) => {
    try{
      const detail = await fetchCorpDetail(c.corpCode);
      const full = { corpCode:c.corpCode, name:detail.name||c.name, ticker:detail.ticker||c.ticker, founded:detail.founded, ceo:detail.ceo, sector:"-" };
      if(target==="corp"){ setCorp(full); setResult(null); }
      else { setCCorp(full); }
    }catch(e){
      const fallback = { corpCode:c.corpCode, name:c.name, ticker:c.ticker, founded:null, ceo:"-", sector:"-" };
      if(target==="corp"){ setCorp(fallback); setResult(null); }
      else { setCCorp(fallback); }
    }
  };

  return(
    <div style={{background:"#080c14",minHeight:"100vh",color:"#e2e8f0",fontFamily:"'Noto Sans KR',sans-serif",maxWidth:430,margin:"0 auto"}}>
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.4)}`}</style>

    {/* 헤더 */}
    <div style={{background:"#080c14",padding:"0 16px",borderBottom:"1px solid #1a2035",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22}}>☯️</span>
          <div>
            <div style={{fontSize:18,fontWeight:900,letterSpacing:-0.5,background:"linear-gradient(90deg,#c8963e,#f0c060)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>기업팔자</div>
            <div style={{fontSize:9,color:"#4a5568",letterSpacing:3,marginTop:-2}}>企業八字 · 만세력 기반</div>
          </div>
        </div>
        <div style={{fontSize:10,color:"#374151",background:"#0d1220",border:"1px solid #1e2740",borderRadius:6,padding:"3px 8px"}}>📡 DART 연동</div>
      </div>
      <div style={{display:"flex",overflowX:"auto",borderTop:"1px solid #1a2035",scrollbarWidth:"none"}}>
        {MAIN_TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{flexShrink:0,padding:"10px 16px",background:"none",border:"none",color:tab===t?"#c8963e":"#4a5568",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",borderBottom:tab===t?"2px solid #c8963e":"2px solid transparent",whiteSpace:"nowrap"}}>
            {t==="투자자궁합"?"💑 궁합":t==="기간운세"?"📅 기간":t}
          </button>
        ))}
      </div>
    </div>

    <div style={{padding:"16px",paddingBottom:48}}>

      {/* ── 분석 탭 ── */}
      {tab==="분석"&&(
        <div>
          <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:16,padding:16,marginBottom:16}}>
            <div style={{fontSize:13,color:"#c8963e",fontWeight:700,marginBottom:12,letterSpacing:1}}>☰ 기업 검색</div>
            <CorpSearch onSelect={c=>{setCorp(c);setResult(null);}}/>
            {corp&&(
              <div style={{marginTop:12,background:"#111827",border:"1px solid #c8963e33",borderRadius:10,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>{corp.name}</div>
                    <div style={{fontSize:12,color:"#64748b",marginBottom:2}}>{corp.ticker} · {corp.sector} · 대표: {corp.ceo}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:"#4a5568",marginBottom:3}}>설립일 (DART)</div>
                    <div style={{fontSize:14,fontWeight:800,color:"#c8963e"}}>{corp.founded}</div>
                  </div>
                </div>
              </div>
            )}
            <button style={{width:"100%",marginTop:12,background:!corp||loading?"#1e2740":"linear-gradient(90deg,#8a6000,#c8963e)",color:!corp||loading?"#4a5568":"#000",border:"none",borderRadius:10,padding:13,fontSize:15,fontWeight:900,cursor:!corp||loading?"default":"pointer",fontFamily:"inherit"}}
              onClick={analyze} disabled={!corp||loading}>
              {loading?"사주 해석 중...":"🔮 팔자 풀이 시작"}
            </button>
          </div>

          {!result&&!loading&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#4a5568",marginBottom:8}}>🔥 인기 기업</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {POPULAR_CORPS.map(c=>(
                  <button key={c.corpCode}
                    style={{background:corp?.corpCode===c.corpCode?"#1e2740":"#0d1220",border:`1px solid ${corp?.corpCode===c.corpCode?"#c8963e":"#1e2740"}`,borderRadius:20,padding:"5px 14px",fontSize:12,color:corp?.corpCode===c.corpCode?"#c8963e":"#94a3b8",cursor:"pointer",fontFamily:"inherit"}}
                    onClick={()=>pickPopular(c,"corp")}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading&&(
            <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:16,padding:24,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12,display:"inline-block",animation:"spin 2s linear infinite"}}>☯️</div>
              <div style={{fontSize:14,color:"#c8963e",fontWeight:700,marginBottom:4}}>{LOADING_MSGS[Math.min(lstep,LOADING_MSGS.length-1)]}</div>
              <div style={{fontSize:11,color:"#4a5568"}}>만세력(萬歲曆) 기반 정밀 분석</div>
              <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:14}}>
                {LOADING_MSGS.map((_,i)=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:i<=lstep?"#c8963e":"#1e2740",transition:"background 0.3s"}}/>)}
              </div>
            </div>
          )}

          {result&&!loading&&(()=>{
            const {saju,corp:c,traitIdx}=result;
            const trait = TRAIT[saju.dayElem]?.[traitIdx] || TRAIT.토[0];
            const weak  = WEAKNESS[saju.dayElem]?.[traitIdx] || WEAKNESS.토[0];
            return(
              <div>
                {/* 종합 등급 */}
                <div style={{background:"linear-gradient(135deg,#0d1a08,#1a2a10)",border:"1px solid #2a4a18",borderRadius:16,padding:20,marginBottom:14,textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#4a7a28",letterSpacing:3,marginBottom:4}}>{c.name} 기업사주 종합 (만세력 기반)</div>
                  <div style={{fontSize:11,color:"#374151",marginBottom:10}}>{c.ticker} · {c.sector} · 설립 {c.founded}</div>
                  <div style={{fontSize:34,fontWeight:900,color:"#4caf50",marginBottom:6}}>{saju.grade}</div>
                  <div style={{fontSize:13,color:"#64748b",marginBottom:14}}>{saju.zodiac} 해생 · 일간 {saju.dayPillar.stem} · {saju.wangsang}</div>
                  <div style={{display:"flex",justifyContent:"center",gap:8}}>
                    {[saju.dayElem,saju.strongElem,saju.weakElem].map((e,i)=>(
                      <div key={i} style={{background:ec(e)+"22",border:`1px solid ${ec(e)}55`,borderRadius:8,padding:"4px 10px",fontSize:12,color:ec(e),fontWeight:700}}>
                        {ELEM_EM[e]} {ELEM_KR[e]} {i===0?"(일간)":i===1?"(강)":"(약)"}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 사주 4기둥 */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:10}}>四柱六字 (만세력 기준 · 시주 제외)</div>
                  <div style={{display:"flex",gap:8}}>
                    <PillarCard label="연주(年柱)" pillar={saju.yearPillar}  color="#c8963e"/>
                    <PillarCard label="월주(月柱)" pillar={saju.monthPillar} color="#60a5fa"/>
                    <PillarCard label="일주(日柱)" pillar={saju.dayPillar}   color="#4ade80"/>
                  </div>
                </div>

                {/* 왕상휴수사 + 십성 */}
                <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:12}}>왕상휴수사(旺相休囚死) · 십성(十星)</div>
                  <div style={{display:"flex",gap:10,marginBottom:12}}>
                    <div style={{flex:1,background:"#111827",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                      <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>일간 강약</div>
                      <div style={{fontSize:18,fontWeight:800,color:"#c8963e"}}>{saju.wangsang}</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:3}}>기운 {saju.wsScore}/30점</div>
                    </div>
                    <div style={{flex:1,background:"#111827",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                      <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>주도 십성</div>
                      <div style={{fontSize:18,fontWeight:800,color:"#60a5fa"}}>{saju.domSS}</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:3}}>{Object.entries(saju.ssc).map(([k,v])=>v>0?`${k}${v}`:null).filter(Boolean).join(" ")}</div>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.7,marginBottom:8}}>{WANGSANG_TEXT[saju.wangsang]}</div>
                  <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.7}}>{SIBSEONG_TEXT[saju.domSS]}</div>
                </div>

                {/* 운세 지수 */}
                <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:14}}>기업 운세 지수 (왕상휴수사 기반)</div>
                  <ScoreBar label="활력운 (비겁·식상 기운)" value={saju.scores.vitality} color="#c8963e"/>
                  <ScoreBar label="재물운 (재성 기운)"        value={saju.scores.wealth}   color="#4ade80"/>
                  <ScoreBar label="성장운 (인성 기운)"        value={saju.scores.growth}   color="#60a5fa"/>
                </div>

                {/* 팔자 풀이 */}
                <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:16,marginBottom:14}}>
                  <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:12}}>팔자 풀이</div>
                  <div style={{fontSize:14,color:"#c8963e",fontWeight:700,marginBottom:6}}>✦ 기업의 본명</div>
                  <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,marginBottom:14}}>{trait}</div>
                  <div style={{fontSize:14,color:"#60a5fa",fontWeight:700,marginBottom:6}}>☽ 주의할 점</div>
                  <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8}}>{weak}</div>
                </div>

                <ResultAd corpName={c.name}/>

                <button style={{width:"100%",background:"#0d1220",border:"1px solid #4a7a5544",borderRadius:12,padding:14,fontSize:13,color:"#4ade80",fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}
                  onClick={()=>setTab("기간운세")}>
                  📅 {c.name} 기간별 운세 보기 →
                </button>
                <button style={{width:"100%",background:"#0d1220",border:"1px solid #c8963e44",borderRadius:12,padding:14,fontSize:13,color:"#c8963e",fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:14}}
                  onClick={()=>{setCCorp(c);setTab("투자자궁합");}}>
                  💑 나와 {c.name}의 투자 궁합 보기 →
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── 기간운세 탭 ── */}
      {tab==="기간운세"&&(
        <div>
          {!corp&&(
            <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:13,color:"#c8963e",fontWeight:700,marginBottom:10}}>기업을 먼저 선택해주세요</div>
              <CorpSearch onSelect={c=>setCorp(c)}/>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                {POPULAR_CORPS.slice(0,6).map(c=>(
                  <button key={c.corpCode}
                    style={{background:"#111827",border:"1px solid #1e2740",borderRadius:16,padding:"4px 12px",fontSize:11,color:"#94a3b8",cursor:"pointer",fontFamily:"inherit"}}
                    onClick={()=>pickPopular(c,"corp")}>{c.name}</button>
                ))}
              </div>
            </div>
          )}
          {corp&&(
            <div>
              <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:800}}>{corp.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{corp.ticker} · 설립 {corp.founded}</div>
                </div>
                <button onClick={()=>setCorp(null)}
                  style={{background:"none",border:"1px solid #1e2740",borderRadius:8,padding:"4px 10px",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>변경</button>
              </div>

              {/* 전체 요약 */}
              <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:14,marginBottom:14}}>
                <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:12}}>기간별 운세 한눈에 보기</div>
                {PERIOD_TABS.map(p=>{
                  const f=getPeriodFortune(corp.founded,p.id);
                  return(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
                      <div style={{width:22,textAlign:"center",fontSize:14}}>{p.icon}</div>
                      <div style={{width:28,fontSize:12,color:"#64748b",flexShrink:0}}>{p.label}</div>
                      <div style={{flex:1,background:"#111827",borderRadius:6,height:7,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${f.score}%`,background:f.gradeColor,borderRadius:6}}/>
                      </div>
                      <div style={{width:22,fontSize:12,fontWeight:800,color:f.gradeColor,textAlign:"right"}}>{f.score}</div>
                      <div style={{width:36,fontSize:10,color:f.gradeColor,fontWeight:700,textAlign:"right"}}>{f.gradeLabel.split("(")[0]}</div>
                    </div>
                  );
                })}
              </div>

              {/* 기간 탭 */}
              <div style={{display:"flex",background:"#0d1220",borderRadius:12,padding:4,gap:2,marginBottom:14,border:"1px solid #1e2740"}}>
                {PERIOD_TABS.map(p=>(
                  <button key={p.id} onClick={()=>setPTab(p.id)}
                    style={{flex:1,background:pTab===p.id?"#1e2740":"none",border:"none",borderRadius:9,padding:"8px 0",cursor:"pointer",fontFamily:"inherit"}}>
                    <div style={{fontSize:14}}>{p.icon}</div>
                    <div style={{fontSize:10,color:pTab===p.id?"#c8963e":"#4a5568",fontWeight:700,marginTop:2}}>{p.label}</div>
                  </button>
                ))}
              </div>

              {/* 선택된 기간 카드 */}
              {(()=>{
                const f=getPeriodFortune(corp.founded,pTab);
                return(
                  <div style={{background:"#0d1220",border:`1px solid ${f.gradeColor}33`,borderRadius:16,padding:18,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div>
                        <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:4}}>{getPeriodLabel(pTab)} 운세</div>
                        <div style={{fontSize:20,fontWeight:900,color:f.gradeColor}}>{f.gradeLabel}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:28,fontWeight:900,color:f.gradeColor,lineHeight:1}}>{f.score}</div>
                        <div style={{fontSize:10,color:"#4a5568",marginTop:2}}>운세 지수</div>
                      </div>
                    </div>
                    <div style={{background:"#1e2740",borderRadius:6,height:6,overflow:"hidden",marginBottom:14}}>
                      <div style={{height:"100%",width:`${f.score}%`,background:f.gradeColor,borderRadius:6}}/>
                    </div>
                    <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,marginBottom:12}}>{f.text}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,background:"#111827",borderRadius:8,padding:"6px 10px"}}>
                      <span style={{fontSize:12}}>🔄</span>
                      <span style={{fontSize:11,color:"#4a5568"}}>{getNextUpdate(pTab)}</span>
                    </div>
                  </div>
                );
              })()}

              <BannerAd/>
            </div>
          )}
        </div>
      )}

      {/* ── 투자자궁합 탭 ── */}
      {tab==="투자자궁합"&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#1a1030,#0d1a30)",border:"1px solid #2a1a50",borderRadius:14,padding:14,marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{fontSize:28}}>💑</div>
            <div>
              <div style={{fontSize:14,fontWeight:800,marginBottom:3}}>투자자 × 기업 인연 분석</div>
              <div style={{fontSize:12,color:"#64748b",lineHeight:1.6}}>생년월일의 오행과 기업 설립일의 오행을 대조하여 인연 지수를 풀이합니다.</div>
            </div>
          </div>
          <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{fontSize:12,color:"#60a5fa",fontWeight:700,marginBottom:10,letterSpacing:1}}>👤 투자자 정보</div>
            <input style={{width:"100%",background:"#111827",border:"1px solid #1e2740",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:14,fontFamily:"inherit",marginBottom:8,boxSizing:"border-box"}}
              placeholder="이름 또는 닉네임 (선택)" value={invName} onChange={e=>setInvName(e.target.value)}/>
            <div style={{fontSize:11,color:"#4a5568",marginBottom:5}}>생년월일</div>
            <input type="date" style={{width:"100%",background:"#111827",border:"1px solid #1e2740",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:14,fontFamily:"inherit",marginBottom:16,boxSizing:"border-box",colorScheme:"dark"}}
              value={invBirth} onChange={e=>setInvBirth(e.target.value)}/>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{flex:1,height:1,background:"#1e2740"}}/><div style={{fontSize:18}}>×</div><div style={{flex:1,height:1,background:"#1e2740"}}/>
            </div>
            <div style={{fontSize:12,color:"#c8963e",fontWeight:700,marginBottom:10,letterSpacing:1}}>🏢 기업 검색</div>
            <CorpSearch onSelect={c=>setCCorp(c)} placeholder="기업명 또는 티커로 검색"/>
            {cCorp&&(
              <div style={{marginTop:10,background:"#111827",border:"1px solid #c8963e33",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700}}>{cCorp.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{cCorp.ticker} · 설립 {cCorp.founded}</div>
                </div>
                <div style={{fontSize:10,color:"#374151",background:"#0d1220",borderRadius:4,padding:"2px 6px"}}>📡 DART</div>
              </div>
            )}
            <button style={{width:"100%",marginTop:14,background:cLoading||!invBirth||!cCorp?"#1e2740":"linear-gradient(90deg,#1a3060,#3060c0)",color:cLoading||!invBirth||!cCorp?"#64748b":"#fff",border:"none",borderRadius:10,padding:13,fontSize:15,fontWeight:900,cursor:cLoading||!invBirth||!cCorp?"default":"pointer",fontFamily:"inherit"}}
              onClick={calcCompat} disabled={cLoading||!invBirth||!cCorp}>
              {cLoading?"인연 분석 중...":"🔮 인연 지수 분석"}
            </button>
          </div>

          {cLoading&&(
            <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:16,padding:24,textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12,display:"inline-block",animation:"spin 2s linear infinite"}}>💑</div>
              <div style={{fontSize:14,color:"#60a5fa",fontWeight:700}}>{COMPAT_MSGS[Math.min(cStep,COMPAT_MSGS.length-1)]}</div>
            </div>
          )}

          {cResult&&!cLoading&&(
            <div>
              <div style={{background:"linear-gradient(135deg,#0d0a20,#1a1030)",border:`1px solid ${cResult.compat.cColor}44`,borderRadius:16,padding:20,marginBottom:14,textAlign:"center"}}>
                <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:8}}>{cResult.invName} × {cResult.corpName}</div>
                <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:20}}>
                  <CompatGauge score={cResult.compat.score} color={cResult.compat.cColor}/>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:17,fontWeight:900,color:cResult.compat.cColor,marginBottom:5}}>{cResult.compat.cGrade}</div>
                    <div style={{fontSize:11,color:"#64748b",marginBottom:3}}>관계</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:8}}>{cResult.compat.relation}</div>
                    <div style={{fontSize:11,background:cResult.compat.cColor+"22",color:cResult.compat.cColor,borderRadius:6,padding:"2px 8px",display:"inline-block",fontWeight:700}}>{cResult.compat.role}형 투자자</div>
                  </div>
                </div>
              </div>

              {/* 오행 흐름 */}
              <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:16,marginBottom:14}}>
                <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:10}}>오행 상생·상극 관계</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0}}>
                  {[
                    {label:"투자자",elem:cResult.invSaju.dayElem,pillar:cResult.invSaju.dayPillar},
                    null,
                    {label:"기업",elem:cResult.corSaju.dayElem,pillar:cResult.corSaju.dayPillar},
                  ].map((item,i)=>
                    item ? (
                      <div key={i} style={{textAlign:"center"}}>
                        <div style={{width:60,height:60,borderRadius:"50%",background:ec(item.elem)+"22",border:`2px solid ${ec(item.elem)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 5px"}}>{ELEM_EM[item.elem]}</div>
                        <div style={{fontSize:11,color:ec(item.elem),fontWeight:800}}>{ELEM_KR[item.elem]}</div>
                        <div style={{fontSize:10,color:"#64748b"}}>{item.label}</div>
                        <div style={{fontSize:10,color:"#4a5568"}}>{item.pillar.stem.split("(")[0]}·{item.pillar.branch.split("(")[0]}</div>
                      </div>
                    ) : (
                      <div key={i} style={{flex:1,textAlign:"center",padding:"0 8px"}}>
                        <div style={{fontSize:10,color:cResult.compat.cColor,fontWeight:700,marginBottom:3}}>{cResult.compat.labelTag}</div>
                        <div style={{height:2,background:`linear-gradient(90deg,${ec(cResult.invSaju.dayElem)},${cResult.compat.cColor},${ec(cResult.corSaju.dayElem)})`,borderRadius:2,position:"relative"}}>
                          <div style={{position:"absolute",right:-4,top:-4,fontSize:10,color:cResult.compat.cColor}}>▶</div>
                        </div>
                        <div style={{fontSize:10,color:"#64748b",marginTop:3}}>{cResult.compat.relation}</div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:16,marginBottom:14}}>
                <div style={{fontSize:11,color:"#4a5568",letterSpacing:2,marginBottom:12}}>투자자 기질 · 인연 풀이</div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:ec(cResult.invSaju.dayElem)+"22",border:`2px solid ${ec(cResult.invSaju.dayElem)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{ELEM_EM[cResult.invSaju.dayElem]}</div>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:ec(cResult.invSaju.dayElem)}}>{cResult.invType.type}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{ELEM_KR[cResult.invSaju.dayElem]} · {cResult.invSaju.zodiac}</div>
                  </div>
                </div>
                <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,marginBottom:12}}>{cResult.invType.desc}</div>
                <div style={{fontSize:14,color:"#c8963e",fontWeight:700,marginBottom:6}}>✦ 인연의 성격</div>
                <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,marginBottom:12}}>{cResult.compat.desc}</div>
                <div style={{fontSize:14,color:"#60a5fa",fontWeight:700,marginBottom:6}}>☽ 투자 조언</div>
                <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.8}}>{cResult.compat.advice}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 히스토리 탭 ── */}
      {tab==="히스토리"&&(
        <div>
          <div style={{fontSize:12,color:"#4a5568",letterSpacing:2,marginBottom:14}}>최근 조회 기업</div>
          {history.length===0&&<div style={{textAlign:"center",color:"#4a5568",fontSize:14,paddingTop:40}}>아직 조회한 기업이 없습니다</div>}
          {history.map((h,i)=>(
            <div key={i}>
              <div style={{background:"#0d1220",border:"1px solid #1e2740",borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>{h.name} <span style={{fontSize:11,color:"#4a5568",fontWeight:400}}>{h.ticker}</span></div>
                  <div style={{fontSize:12,color:"#4a5568"}}>{h.date}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:800,color:h.grade.includes("대길")?"#4ade80":h.grade.includes("중길")?"#c8963e":"#ef4444"}}>{h.grade}</div>
                  <div style={{fontSize:12,color:ec(h.dayElem)}}>{ELEM_EM[h.dayElem]} {ELEM_KR[h.dayElem]}</div>
                </div>
              </div>
              {i===1&&<InFeedAd/>}
            </div>
          ))}
        </div>
      )}

      <div style={{borderTop:"1px solid #1a2035",marginTop:24,paddingTop:16,textAlign:"center"}}>
        <div style={{fontSize:10,color:"#374151",lineHeight:1.6}}>본 서비스는 재미 목적의 운세 서비스입니다.<br/>실제 투자 판단의 근거로 활용하지 마십시오.</div>
      </div>
    </div>
    <Analytics />
    </div>
  );
}
