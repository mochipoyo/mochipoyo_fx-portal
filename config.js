/*
 * もちぽよ マーケットポータル 設定ファイル
 * ------------------------------------------------------------
 * このファイルだけ書き換えれば、サイト名・会員認証・表示銘柄などを変更できます。
 * GitHubの画面でこのファイルを開き、鉛筆アイコンから編集 → 「Commit changes」で反映されます
 * （反映まで数分かかります）。
 */
window.PORTAL_CONFIG = {
  // ── サイトの表示名 ───────────────────────────────
  siteName: "もちぽよ マーケットポータル",
  tagline: "波形で読むFX　Fincs会員専用",

  // ── Fincs会員認証（トークンアクセスリンク） ────────────
  gate: {
    // false にすると認証なしで誰でも見られます（動作確認用）。本番は true のまま。
    enabled: false,
    // Fincsが発行するトークン（JWT）の発行元。通常は変更不要。
    issuer: "https://api.fincs.jp",
    // 署名検証用の公開鍵。上から順に試します。
    //  1) data/fincs_jwks.json … GitHub Actionsが毎日Fincsから取得して保存するコピー
    //  2) Fincsの公開URL（ブラウザから直接取得できない環境もあります）
    jwksUrls: ["data/fincs_jwks.json", "https://api.fincs.jp/token_access_link/jwks"],
    // Fincsの外部アプリ設定で登録した audience（通常はこのサイトのURL）。
    // 空の配列なら「このサイトのオリジン」と「このページのURL」を自動で許可します。
    // 認証に失敗する場合は、URLの末尾に ?gate=debug を付けて開くと、トークンの aud が表示されます。
    audiences: [],
    // 閲覧を許可するプランID。空の配列なら、Fincsが発行したトークンはプランを問わず許可します。
    allowedPlanIds: [],
    // プランIDが入っているトークン内の項目名
    planClaim: "plan_id",
    // 一度認証したら、何時間はFincsを経由せずに再訪問できるか
    sessionHours: 24,
    // 未認証の人に表示する「Fincsを開く」ボタンのリンク先（空ならボタンを出しません）
    fincsUrl: ""
  },

  // ── ヘッダー下に流れるレート（TradingView） ─────────────
  ticker: [
    { s: "FX:GBPJPY", t: "ポンド円" },
    { s: "FX:USDJPY", t: "ドル円" },
    { s: "FX:EURJPY", t: "ユーロ円" },
    { s: "FX:AUDJPY", t: "豪ドル円" },
    { s: "FX:GBPUSD", t: "ポンドドル" },
    { s: "FX:EURUSD", t: "ユーロドル" },
    { s: "TVC:DXY", t: "ドル指数" },
    { s: "TVC:US10Y", t: "米10年債" },
    { s: "TVC:JP10Y", t: "日本10年債" },
    { s: "OANDA:XAUUSD", t: "金" },
    { s: "OANDA:JP225USD", t: "日経225" },
    { s: "OANDA:SPX500USD", t: "S&P500" }
  ],

  // ── チャートタブで切り替えられる銘柄 ──────────────────
  chartSymbols: [
    { s: "FX:GBPJPY", t: "ポンド円" },
    { s: "FX:USDJPY", t: "ドル円" },
    { s: "FX:EURJPY", t: "ユーロ円" },
    { s: "FX:AUDJPY", t: "豪ドル円" },
    { s: "FX:GBPUSD", t: "ポンドドル" },
    { s: "FX:EURUSD", t: "ユーロドル" },
    { s: "FX:EURGBP", t: "ユーロポンド" },
    { s: "TVC:DXY", t: "ドル指数" },
    { s: "OANDA:XAUUSD", t: "金" }
  ],
  defaultChartSymbol: "FX:GBPJPY",

  // ── マーケット一覧（ミニチャート） ─────────────────────
  marketGroups: [
    { title: "円クロス", symbols: [
      ["FX:GBPJPY", "ポンド円"], ["FX:USDJPY", "ドル円"], ["FX:EURJPY", "ユーロ円"],
      ["FX:AUDJPY", "豪ドル円"], ["FX:NZDJPY", "NZドル円"], ["FX:CADJPY", "カナダドル円"], ["FX:CHFJPY", "スイスフラン円"]
    ]},
    { title: "ドルストレート・その他", symbols: [
      ["FX:GBPUSD", "ポンドドル"], ["FX:EURUSD", "ユーロドル"], ["FX:AUDUSD", "豪ドル米ドル"],
      ["FX:USDCHF", "ドルスイスフラン"], ["FX:USDCAD", "ドルカナダドル"], ["FX:EURGBP", "ユーロポンド"]
    ]},
    { title: "ドル指数・金利", symbols: [
      ["TVC:DXY", "ドル指数"], ["TVC:US10Y", "米10年債利回り"], ["TVC:JP10Y", "日本10年債利回り"], ["TVC:GB10Y", "英10年債利回り"]
    ]},
    { title: "株価指数", symbols: [
      ["OANDA:JP225USD", "日経225"], ["OANDA:SPX500USD", "S&P500"], ["OANDA:NAS100USD", "NASDAQ100"], ["OANDA:UK100GBP", "英FTSE100"]
    ]},
    { title: "商品・暗号資産", symbols: [
      ["OANDA:XAUUSD", "金"], ["TVC:USOIL", "WTI原油"], ["BITSTAMP:BTCUSD", "ビットコイン"]
    ]}
  ],

  // ── 主要国の10年債利回り（TradingView） ────────────────
  yieldSymbols: [
    ["TVC:US10Y", "米国"], ["TVC:JP10Y", "日本"], ["TVC:GB10Y", "英国"], ["TVC:DE10Y", "ドイツ"],
    ["TVC:AU10Y", "豪州"], ["TVC:NZ10Y", "NZ"], ["TVC:CA10Y", "カナダ"], ["TVC:CH10Y", "スイス"]
  ],

  // ── 経済指標カレンダー（TradingView）の対象国 ──────────
  calendarCountries: "us,jp,gb,eu,au,nz,ca,ch",

  // ── ホームの「朝のチェックリスト」 ─────────────────────
  // 自由に書き換えてください（チェック状態は各自のブラウザに1日だけ保存されます）
  checklist: [
    "きょうの予定（指標・中銀・休場）を確認した",
    "ポンド円の日足・4時間足で、いまの波の向きを確認した",
    "通貨の強弱で、強い通貨・弱い通貨を確認した",
    "大きな予定の前後は取引を控える時間を決めた",
    "損切りの位置と1回の取引で許容する損失を決めた"
  ],

  // ── お問い合わせ・ご意見の案内（空なら表示しません） ─────────
  feedbackUrl: ""
};
