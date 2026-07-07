javascript// api/search.js
// corp_code(DART 고유번호)로 기업 상세정보(설립일 등)를 조회하는 함수

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { corpCode } = req.query;
  const DART_KEY = process.env.DART_API_KEY;

  if (!corpCode) {
    return res.status(400).json({ error: "corpCode가 필요합니다" });
  }
  if (!DART_KEY) {
    return res.status(500).json({ error: "DART_API_KEY가 설정되지 않았습니다" });
  }

  try {
    const url = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "000") {
      return res.status(404).json({ error: data.message || "조회 실패" });
    }

    return res.status(200).json({
      name: data.corp_name,
      ticker: data.stock_code,
      founded: data.est_dt
        ? `${data.est_dt.slice(0,4)}-${data.est_dt.slice(4,6)}-${data.est_dt.slice(6,8)}`
        : null,
      ceo: data.ceo_nm,
      address: data.adres,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}