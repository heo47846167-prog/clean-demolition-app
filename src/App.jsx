import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { supabase } from "./supabase";

const STORAGE_KEYS = {
  requests: "clean-demolition-requests-v12",
  authUsers: "clean-demolition-auth-users-v12",
  authSession: "clean-demolition-auth-session-v12",
};

const ADMIN_ACCOUNT = {
  id: "admin",
  password: "1234",
  companyName: "클린철거 관리자",
  phone: "",
  role: "admin",
  approved: true,
};

const KAKAO_JS_KEY = "";
const PAGE_SIZE = 10;
const MY_PAGE_SIZE = 5;

const createInitialDemolitionData = () => ({
  바닥철거: [
    { id: 1, name: "데코타일 철거", price: 5000, unit: "평" },
    { id: 2, name: "장판 철거", price: 4000, unit: "평" },
    { id: 3, name: "마루 철거", price: 7000, unit: "평" },
    { id: 4, name: "타일 철거", price: 15000, unit: "평" },
  ],
  벽체철거: [
    { id: 5, name: "석고보드 벽체 철거", price: 12000, unit: "m²" },
    { id: 6, name: "경량벽체 철거", price: 10000, unit: "m²" },
    { id: 7, name: "조적벽 철거", price: 35000, unit: "m²" },
  ],
  천장철거: [
    { id: 8, name: "텍스 철거", price: 6000, unit: "평" },
    { id: 9, name: "석고천장 철거", price: 9000, unit: "평" },
    { id: 10, name: "SMC 천장 철거", price: 8000, unit: "평" },
  ],
  욕실철거: [
    { id: 11, name: "욕실 전체 철거", price: 800000, unit: "식" },
    { id: 12, name: "변기 철거", price: 50000, unit: "EA" },
    { id: 13, name: "세면대 철거", price: 40000, unit: "EA" },
  ],
  주방철거: [
    { id: 14, name: "싱크대 철거", price: 150000, unit: "식" },
    { id: 15, name: "상부장 철거", price: 80000, unit: "식" },
    { id: 16, name: "하부장 철거", price: 90000, unit: "식" },
  ],
  기타철거: [
    { id: 17, name: "문 철거", price: 50000, unit: "EA" },
    { id: 18, name: "샷시 철거", price: 120000, unit: "EA" },
    { id: 19, name: "붙박이장 철거", price: 150000, unit: "식" },
  ],
});

const initialUsers = [ADMIN_ACCOUNT];

function loadLocalStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`${key} 로드 실패`, error);
    return fallback;
  }
}

function saveLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`${key} 저장 실패`, error);
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function formatDate(value) {
  if (!value) return "-";
  return value;
}

function calculateAmounts(items = []) {
  const supplyAmount = items.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 0);
  }, 0);

  const vat = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vat;

  return {
    supplyAmount,
    vat,
    totalAmount,
  };
}

function getStatusLabel(status) {
  return statusToLabel(status);
}

function normalizeStatus(rawStatus, rawLabel = "") {
  const source = String(rawStatus || rawLabel || "").trim();

  switch (source) {
    case "requested":
    case "요청접수":
    case "접수":
      return "requested";
    case "reviewing":
    case "검토중":
      return "reviewing";
    case "confirmed":
    case "확정":
    case "일정확정":
      return "confirmed";
    case "completed":
    case "완료":
    case "공사완료":
      return "completed";
    case "on_hold":
    case "보류":
      return "on_hold";
    case "cancelled":
    case "일정취소":
    case "취소":
      return "cancelled";
    default:
      return source || "requested";
  }
}

function statusToLabel(status) {
  switch (normalizeStatus(status)) {
    case "requested":
      return "요청접수";
    case "reviewing":
      return "검토중";
    case "confirmed":
      return "일정확정";
    case "completed":
      return "공사완료";
    case "on_hold":
      return "보류";
    case "cancelled":
      return "일정취소";
    default:
      return String(status || "요청접수");
  }
}

function normalizeRequestRow(row = {}) {
  const normalizedStatus = normalizeStatus(row.status, row.status_label);
  const detailItems = Array.isArray(row.detailItems)
    ? row.detailItems
    : Array.isArray(row.detail_items)
    ? row.detail_items
    : Array.isArray(row.items)
    ? row.items
    : [];

  const actualDetailItems = Array.isArray(row.actualDetailItems)
    ? row.actualDetailItems
    : Array.isArray(row.actual_detail_items)
    ? row.actual_detail_items
    : [];

  return {
    ...row,
    user_id: row.user_id || row.userId || "",
    companyName: row.companyName || row.company_name || row.customer_name || "",
    company_name: row.company_name || row.companyName || row.customer_name || "",
    customer_name: row.customer_name || row.company_name || row.companyName || "",
    requestDate: row.requestDate || row.request_date || "",
    request_date: row.request_date || row.requestDate || "",
    requestTime: row.requestTime || row.request_time || "",
    detailItems,
    detail_items: detailItems,
    items: detailItems,
    actualDetailItems,
    actual_detail_items: actualDetailItems,
    totalPrice:
      Number(
        row.totalPrice ??
          row.total_amount ??
          row.settled_total_price ??
          row.supply_amount ??
          0
      ) || 0,
    settledTotalPrice:
      Number(row.settledTotalPrice ?? row.settled_total_price ?? 0) || 0,
    pdfReady: Boolean(row.pdfReady ?? row.pdf_ready ?? false),
    kakaoSent: Boolean(row.kakaoSent ?? row.kakao_sent ?? false),
    paymentCompleted: Boolean(
      row.paymentCompleted ?? row.payment_completed ?? false
    ),
    settledAt: row.settledAt || row.settled_at || "",
    cancelAcknowledged: Boolean(
      row.cancelAcknowledged ?? row.cancel_acknowledged ?? false
    ),
    cancelledAt: row.cancelledAt || row.cancelled_at || "",
    status: normalizedStatus,
    status_label: statusToLabel(normalizedStatus),
  };
}

function normalizeRequestList(rows = []) {
  return rows.map((row) => normalizeRequestRow(row));
}

function normalizeUserRow(row = {}) {
  const loginId = String(row.login_id || row.loginId || row.user_id || row.userId || row.id || "");
  const dbId = row.login_id || row.loginId ? row.id || row.db_id || row.dbId || "" : "";

  return {
    ...row,
    dbId,
    id: loginId,
    login_id: loginId,
    loginId: loginId,
    companyName: row.companyName || row.company_name || "",
    company_name: row.company_name || row.companyName || "",
    phone: row.phone || "",
    password: row.password || "",
    role: row.role || "customer",
    approved: Boolean(row.approved ?? false),
    createdAt: row.createdAt || row.created_at || "",
    created_at: row.created_at || row.createdAt || "",
  };
}

function normalizeUserList(rows = []) {
  return rows.map((row) => normalizeUserRow(row));
}


function cloneItems(items = []) {
  return items.map((item) => ({
    ...item,
    rowId: item.rowId || Date.now() + Math.floor(Math.random() * 1000),
  }));
}

function calculateTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.total || 0), 0);
}

function calculateItemFallbackTotal(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const rowTotal = Number(item?.total);
    if (!Number.isNaN(rowTotal) && rowTotal > 0) {
      return sum + rowTotal;
    }
    return (
      sum +
      Number(item?.price || 0) * Number(item?.quantity || 0)
    );
  }, 0);
}

function getDisplayAmountFromRequest(request = {}) {
  const actualItems = Array.isArray(request.actualDetailItems)
    ? request.actualDetailItems
    : Array.isArray(request.actual_detail_items)
    ? request.actual_detail_items
    : [];

  const detailItems = Array.isArray(request.detailItems)
    ? request.detailItems
    : Array.isArray(request.detail_items)
    ? request.detail_items
    : Array.isArray(request.items)
    ? request.items
    : [];

  const fallbackItems = actualItems.length ? actualItems : detailItems;
  const fallbackTotal = calculateItemFallbackTotal(fallbackItems);

  return (
    Number(request.settledTotalPrice ?? request.settled_total_price) ||
    Number(request.totalPrice ?? request.total_amount) ||
    Number(request.supplyAmount ?? request.supply_amount) ||
    fallbackTotal ||
    0
  );
}


function buildKakaoMessage(request) {
  return [
    `[클린철거 일정확정 안내]`,
    `업체명: ${request.companyName}`,
    `현장주소: ${request.address}`,
    `일정: ${formatDate(request.requestDate)}`,
    `합계금액: ${formatNumber(request.totalPrice)}원`,
    `상태: ${getStatusLabel(request.status)}`,
  ].join("\n");
}

function paginate(items, page, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    currentPage: safePage,
  };
}

function sanitizeQuantityInput(value) {
  const numeric = String(value).replace(/[^\d]/g, "");
  if (numeric === "") return "";
  const parsed = parseInt(numeric, 10);
  if (Number.isNaN(parsed) || parsed < 1) return "1";
  return String(parsed);
}

function getSafeQuantity(value) {
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return parsed;
}

function convertSupabaseData(priceItems = []) {
  const grouped = {};

  priceItems
    .filter((item) => item.is_active !== false)
    .slice()
    .sort((a, b) => {
      const categoryCompare = String(a.category_name || "").localeCompare(
        String(b.category_name || ""),
        "ko"
      );
      if (categoryCompare !== 0) return categoryCompare;
      return (a.sort_order || 0) - (b.sort_order || 0);
    })
    .forEach((item) => {
      const categoryName = item.category_name || "기타";
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }

      grouped[categoryName].push({
        id: item.id,
        name: item.item_name,
        price: Number(item.price || 0),
        unit: item.unit || "EA",
        sort_order: item.sort_order || 0,
      });
    });

  return grouped;
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    pages.push(i);
  }

  return (
    <div className="pagination">
      <button
        className="secondary-btn small-btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        이전
      </button>

      <div className="pagination-pages">
        {pages.map((number) => (
          <button
            key={number}
            className={`page-number-btn ${page === number ? "active" : ""}`}
            onClick={() => onChange(number)}
          >
            {number}
          </button>
        ))}
      </div>

      <button
        className="secondary-btn small-btn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        다음
      </button>
    </div>
  );
}

function AppModal({
  open,
  title,
  message,
  onClose,
  confirmText = "확인",
}) {
  if (!open) return null;

  const lines = Array.isArray(message) ? message : [message];

  return (
    <div className="popup-overlay modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {title ? <h3 className="modal-title">{title}</h3> : null}
        <div className="modal-body">
          {lines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-btn full-width" onClick={onClose}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuantityControl({
  value,
  onChange,
  onIncrease,
  onDecrease,
  placeholder = "수량",
  disabled = false,
}) {
  return (
    <div className={`quantity-control ${disabled ? "disabled" : ""}`}>
      <button type="button" className="quantity-btn" onClick={onDecrease} disabled={disabled}>
        -
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="quantity-input"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={onChange}
        onBlur={() => {
          if (String(value).trim() === "") {
            onChange({ target: { value: "1" } });
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button type="button" className="quantity-btn" onClick={onIncrease} disabled={disabled}>
        +
      </button>
    </div>
  );
}

function App() {
  const [demolitionData, setDemolitionData] = useState(() =>
    createInitialDemolitionData()
  );
  const [categoryRecords, setCategoryRecords] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [users, setUsers] = useState(() =>
    initialUsers.map((user) => normalizeUserRow(user))
  );
  const [requests, setRequests] = useState([]);
  const [session, setSession] = useState(() =>
    loadLocalStorage(STORAGE_KEYS.authSession, null)
  );

  const [modalState, setModalState] = useState({
    open: false,
    title: "",
    message: "",
    onClose: null,
  });

  const [authMode, setAuthMode] = useState("login");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [signupForm, setSignupForm] = useState({
    companyName: "",
    phone: "",
    id: "",
    password: "",
    confirmPassword: "",
    businessFile: null,
  });
  const [loginForm, setLoginForm] = useState({
    id: "",
    password: "",
  });

  const [showMyBox, setShowMyBox] = useState(false);
  const [myDetailOpenId, setMyDetailOpenId] = useState(null);
  const [myPage, setMyPage] = useState(1);
  const [settlementDrafts, setSettlementDrafts] = useState({});
  const [showApprovedUsersPopup, setShowApprovedUsersPopup] = useState(false);
  const [approvedSearch, setApprovedSearch] = useState("");

  const [adminTab, setAdminTab] = useState("request");
  const [requestPage, setRequestPage] = useState(1);
  const [progressPage, setProgressPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedSearchInput, setCompletedSearchInput] = useState("");
  const [completedSearchKeyword, setCompletedSearchKeyword] = useState("");
  const [completedDetailOpenId, setCompletedDetailOpenId] = useState(null);

  const categoryList = Object.keys(demolitionData);
  const firstCategory = categoryList[0] || "";
  const firstCategoryOptions = demolitionData[firstCategory] || [];

  const [requestForm, setRequestForm] = useState({
    address: "",
    detailAddress: "",
    requestDate: "",
    category: firstCategory,
    currentItemId: firstCategoryOptions[0] ? String(firstCategoryOptions[0].id) : "",
    currentQuantity: "1",
    detailItems: [],
    memo: "",
  });

  const [adminPriceForm, setAdminPriceForm] = useState({
    category: firstCategory,
    name: "",
    price: "",
    unit: "",
  });

  const openModal = ({ title = "", message = "", onClose = null }) => {
    setModalState({
      open: true,
      title,
      message,
      onClose,
    });
  };

  const closeModal = () => {
    const callback = modalState.onClose;
    setModalState({
      open: false,
      title: "",
      message: "",
      onClose: null,
    });
    if (typeof callback === "function") callback();
  };

  const fetchCatalog = useCallback(async () => {
    try {
      setIsCatalogLoading(true);
      setCatalogError("");

      const { data: priceItems, error: priceItemsError } = await supabase
        .from("price_items")
        .select("*")
        .eq("is_active", true)
        .order("category_name", { ascending: true })
        .order("sort_order", { ascending: true });

      if (priceItemsError) throw priceItemsError;

      const grouped = convertSupabaseData(priceItems || []);
      const nextCategoryRecords = Object.keys(grouped).map((name, index) => ({
        id: name,
        name,
        sort_order: index + 1,
      }));

      setCategoryRecords(nextCategoryRecords);
      setDemolitionData(
        Object.keys(grouped).length > 0 ? grouped : createInitialDemolitionData()
      );
    } catch (error) {
      console.error("Supabase 카탈로그 불러오기 실패", error);
      setCatalogError(
        `카테고리/세부항목 불러오기 실패: ${error.message || error}`
      );
      setDemolitionData(createInitialDemolitionData());
      setCategoryRecords(
        Object.keys(createInitialDemolitionData()).map((name, index) => ({
          id: name,
          name,
          sort_order: index + 1,
        }))
      );
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);


async function fetchRequestsFromDB() {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("요청 목록 불러오기 실패", error);
    return [];
  }

  return normalizeRequestList(data || []);
}

  const fetchUsersFromDB = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalizedUsers = normalizeUserList(data || []).filter(
        (user) => user.id !== ADMIN_ACCOUNT.id
      );

      setUsers([normalizeUserRow(ADMIN_ACCOUNT), ...normalizedUsers]);
      return normalizedUsers;
    } catch (error) {
      console.error("회원 목록 불러오기 실패", error);
      setUsers([normalizeUserRow(ADMIN_ACCOUNT)]);
      return [];
    }
  }, []);


  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    const loadRequests = async () => {
      const data = await fetchRequestsFromDB();
      setRequests(data);
    };

    loadRequests();
  }, []);

  useEffect(() => {
    fetchUsersFromDB();
  }, [fetchUsersFromDB]);

  useEffect(() => {
    saveLocalStorage(STORAGE_KEYS.requests, requests);
  }, [requests]);

  useEffect(() => {
    saveLocalStorage(STORAGE_KEYS.authSession, session);
  }, [session]);

  useEffect(() => {
    if (!requestForm.category && firstCategory) {
      const nextOptions = demolitionData[firstCategory] || [];
      setRequestForm((prev) => ({
        ...prev,
        category: firstCategory,
        currentItemId: nextOptions[0] ? String(nextOptions[0].id) : "",
      }));
    }

    if (!adminPriceForm.category && firstCategory) {
      setAdminPriceForm((prev) => ({ ...prev, category: firstCategory }));
    }
  }, [firstCategory, requestForm.category, adminPriceForm.category, demolitionData]);

  useEffect(() => {
    const existingScript = document.getElementById("daum-postcode-script");
    if (existingScript) return;

    const script = document.createElement("script");
    script.id = "daum-postcode-script";
    script.src =
      "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const existingKakao = document.getElementById("kakao-sdk-script");
    if (existingKakao) return;

    const script = document.createElement("script");
    script.id = "kakao-sdk-script";
    script.src = "https://developers.kakao.com/sdk/js/kakao.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!KAKAO_JS_KEY) return;
    if (!window.Kakao) return;

    try {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY);
      }
    } catch (error) {
      console.error("Kakao SDK 초기화 실패", error);
    }
  }, []);

  const currentUser = useMemo(() => {
    if (!session?.id) return null;
    if (session.id === ADMIN_ACCOUNT.id) {
      return normalizeUserRow(ADMIN_ACCOUNT);
    }

    return (
      users.find(
        (user) =>
          String(user.login_id || user.id) === String(session.id)
      ) || null
    );
  }, [session, users]);

  const currentUserLoginId = String(currentUser?.login_id || currentUser?.id || "");
  const isAdmin = currentUser?.role === "admin";

  const currentCategoryOptions = useMemo(() => {
    return demolitionData[requestForm.category] || [];
  }, [demolitionData, requestForm.category]);

  useEffect(() => {
    if (!requestForm.category) return;
    if (!currentCategoryOptions.length) {
      setRequestForm((prev) => {
        if (prev.currentItemId === "") return prev;
        return { ...prev, currentItemId: "" };
      });
      return;
    }

    const hasCurrentItem = currentCategoryOptions.some(
      (item) => String(item.id) === String(requestForm.currentItemId)
    );

    if (!hasCurrentItem) {
      setRequestForm((prev) => ({
        ...prev,
        currentItemId: String(currentCategoryOptions[0].id),
      }));
    }
  }, [requestForm.category, requestForm.currentItemId, currentCategoryOptions]);

  const requestTotalPrice = useMemo(() => {
    return requestForm.detailItems.reduce((sum, item) => sum + item.total, 0);
  }, [requestForm.detailItems]);

const myRequests = useMemo(() => {
  if (!currentUser || isAdmin) return [];

  return requests.filter((request) => {
    return String(request.user_id) === currentUserLoginId;
  });
}, [requests, currentUserLoginId, currentUser, isAdmin]);

const myRequestSummary = useMemo(() => {
  return {
    total: myRequests.length,
    active: myRequests.filter((request) =>
      ["requested", "reviewing", "on_hold", "confirmed"].includes(
        normalizeStatus(request.status)
      )
    ).length,
    history: myRequests.filter((request) =>
      ["completed", "cancelled"].includes(normalizeStatus(request.status))
    ).length,
  };
}, [myRequests]);

const myPagination = useMemo(
  () => paginate(myRequests, myPage, MY_PAGE_SIZE),
  [myRequests, myPage]
);

  useEffect(() => {
    if (!showMyBox) return;
    if (myPage > myPagination.totalPages) {
      setMyPage(myPagination.totalPages);
    }
  }, [showMyBox, myPage, myPagination.totalPages]);

  const pendingUsers = useMemo(() => {
    return users.filter((user) => user.role !== "admin" && !user.approved);
  }, [users]);

  const approvedUsers = useMemo(() => {
    const keyword = approvedSearch.trim().toLowerCase();
    return users
      .filter((user) => user.role !== "admin" && user.approved)
      .filter((user) => {
        if (!keyword) return true;
        return (
          user.id.toLowerCase().includes(keyword) ||
          user.companyName.toLowerCase().includes(keyword) ||
          (user.phone || "").includes(keyword)
        );
      });
  }, [users, approvedSearch]);

const requestManagementList = useMemo(() => {
  return requests.filter((request) =>
    ["requested", "reviewing", "on_hold"].includes(normalizeStatus(request.status))
  );
}, [requests]);

const progressManagementList = useMemo(() => {
  return requests.filter((request) => {
    const status = normalizeStatus(request.status);

    if (status === "confirmed") return true;
    if (status === "cancelled" && !request.cancelAcknowledged) return true;
    return false;
  });
}, [requests]);

const completedManagementList = useMemo(() => {
  const keyword = completedSearchKeyword.trim().toLowerCase();

  return requests
    .filter((request) => {
      const status = normalizeStatus(request.status);
      return status === "completed" || (status === "cancelled" && request.cancelAcknowledged);
    })
    .filter((request) => {
      if (!keyword) return true;
      return (request.company_name || "").toLowerCase().includes(keyword);
    });
}, [requests, completedSearchKeyword]);

const companySummaryList = useMemo(() => {
  const grouped = {};

  requests.forEach((request) => {
      const companyName =
        request.company_name ||
        request.companyName ||
        request.customer_name ||
        "업체명 없음";

      const status = normalizeStatus(request.status);
      const amount =
        status === "cancelled" ? 0 : Number(getDisplayAmountFromRequest(request));

      const isPaid = Boolean(request.paymentCompleted);

      if (!grouped[companyName]) {
        grouped[companyName] = {
          companyName,
          totalCount: 0,
          cancelledCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
        };
      }

      grouped[companyName].totalCount += 1;

      if (status === "cancelled") {
        grouped[companyName].cancelledCount += 1;
        return;
      }

      if (status !== "completed") {
        return;
      }

      grouped[companyName].totalAmount += amount;

      if (isPaid) {
        grouped[companyName].paidAmount += amount;
      } else {
        grouped[companyName].unpaidAmount += amount;
      }
    });

  return Object.values(grouped).sort((a, b) => b.totalCount - a.totalCount);
}, [requests]);

  const requestPagination = useMemo(
    () => paginate(requestManagementList, requestPage),
    [requestManagementList, requestPage]
  );

  const progressPagination = useMemo(
    () => paginate(progressManagementList, progressPage),
    [progressManagementList, progressPage]
  );

  const completedPagination = useMemo(
    () => paginate(completedManagementList, completedPage),
    [completedManagementList, completedPage]
  );

  useEffect(() => {
    if (requestPage > requestPagination.totalPages) {
      setRequestPage(requestPagination.totalPages);
    }
  }, [requestPage, requestPagination.totalPages]);

  useEffect(() => {
    if (progressPage > progressPagination.totalPages) {
      setProgressPage(progressPagination.totalPages);
    }
  }, [progressPage, progressPagination.totalPages]);

  useEffect(() => {
    if (completedPage > completedPagination.totalPages) {
      setCompletedPage(completedPagination.totalPages);
    }
  }, [completedPage, completedPagination.totalPages]);

  useEffect(() => {
    setCompletedDetailOpenId(null);

    if (adminTab === "request") setRequestPage(1);
    if (adminTab === "progress") setProgressPage(1);
    if (adminTab === "completed") setCompletedPage(1);
  }, [adminTab]);

  const handleSignup = async (event) => {
    event.preventDefault();

    const companyName = signupForm.companyName.trim();
    const phone = signupForm.phone.trim();
    const id = signupForm.id.trim();
    const password = signupForm.password.trim();
    const confirmPassword = signupForm.confirmPassword.trim();

    if (!companyName || !phone || !id || !password || !confirmPassword) {
      openModal({ title: "입력 확인", message: "모든 항목을 입력해 주세요." });
      return;
    }

    if (id.toLowerCase() === ADMIN_ACCOUNT.id.toLowerCase()) {
      openModal({
        title: "아이디 확인",
        message: "사용할 수 없는 아이디입니다.",
      });
      return;
    }

    if (password !== confirmPassword) {
      openModal({
        title: "비밀번호 확인",
        message: "비밀번호와 비밀번호 확인이 일치하지 않습니다.",
      });
      return;
    }

    try {
      const { data: existingUser, error: existingError } = await supabase
        .from("users")
        .select("id, login_id")
        .eq("login_id", id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingUser) {
        openModal({
          title: "아이디 확인",
          message: "이미 사용 중인 아이디입니다.",
        });
        return;
      }

      const { data: insertedUser, error } = await supabase
        .from("users")
        .insert([
          {
            login_id: id,
            password,
            company_name: companyName,
            phone,
            role: "customer",
            approved: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await fetchUsersFromDB();
      setSession({ id: insertedUser?.login_id || id });

      setSignupForm({
        companyName: "",
        phone: "",
        id: "",
        password: "",
        confirmPassword: "",
        businessFile: null,
      });
      setAuthMode("login");

      openModal({
        title: "회원가입 완료",
        message: "회원가입이 완료되었습니다.",
      });
    } catch (error) {
      console.error("회원가입 실패", error);
      openModal({
        title: "회원가입 실패",
        message: `회원가입 저장 중 오류: ${error.message || error}`,
      });
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    const id = loginForm.id.trim();
    const password = loginForm.password.trim();

    if (id === ADMIN_ACCOUNT.id && password === ADMIN_ACCOUNT.password) {
      setSession({ id: ADMIN_ACCOUNT.id });
      setLoginForm({ id: "", password: "" });
      setShowAuthPanel(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("login_id", id)
        .eq("password", password)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        openModal({
          title: "로그인 실패",
          message: "아이디 또는 비밀번호를 확인해 주세요.",
        });
        return;
      }

      const normalizedUser = normalizeUserRow(data);

      setSession({ id: normalizedUser.login_id || normalizedUser.id });
      setLoginForm({ id: "", password: "" });
      setShowAuthPanel(false);
      await fetchUsersFromDB();
    } catch (error) {
      console.error("로그인 실패", error);
      openModal({
        title: "로그인 실패",
        message: `로그인 처리 중 오류: ${error.message || error}`,
      });
    }
  };

  const handleLogout = () => {
    setSession(null);
    setShowMyBox(false);
    setShowAuthPanel(false);
    setAuthMode("login");
    setMyDetailOpenId(null);
    setMyPage(1);
  };

  const handleAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      openModal({
        title: "주소검색",
        message: "주소검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    new window.daum.Postcode({
      oncomplete(data) {
        const fullAddress = data.address || "";
        setRequestForm((prev) => ({
          ...prev,
          address: fullAddress,
        }));
      },
    }).open();
  };

  const handleCategoryChange = (value) => {
    const nextOptions = demolitionData[value] || [];
    setRequestForm((prev) => ({
      ...prev,
      category: value,
      currentItemId: nextOptions[0] ? String(nextOptions[0].id) : "",
      currentQuantity: "1",
    }));
  };

  const updateRequestQuantityInput = (rawValue) => {
    setRequestForm((prev) => ({
      ...prev,
      currentQuantity: sanitizeQuantityInput(rawValue),
    }));
  };

  const increaseRequestQuantity = () => {
    setRequestForm((prev) => ({
      ...prev,
      currentQuantity: String(getSafeQuantity(prev.currentQuantity) + 1),
    }));
  };

  const decreaseRequestQuantity = () => {
    setRequestForm((prev) => ({
      ...prev,
      currentQuantity: String(Math.max(1, getSafeQuantity(prev.currentQuantity) - 1)),
    }));
  };

  const handleAddCurrentItem = () => {
    const quantity = getSafeQuantity(requestForm.currentQuantity);

    if (!requestForm.category) {
      openModal({
        title: "입력 확인",
        message: "철거 카테고리를 선택해 주세요.",
      });
      return;
    }

    if (requestForm.currentItemId === "" || requestForm.currentItemId === null || requestForm.currentItemId === undefined) {
      openModal({
        title: "입력 확인",
        message: "세부내용을 선택해 주세요.",
      });
      return;
    }

    const selectedItem = currentCategoryOptions.find(
      (item) => String(item.id) === String(requestForm.currentItemId)
    );

    if (!selectedItem) {
      openModal({
        title: "항목 확인",
        message: "선택한 세부 항목을 찾을 수 없습니다.",
      });
      return;
    }

    setRequestForm((prev) => {
      const existingIndex = prev.detailItems.findIndex(
        (item) =>
          item.category === prev.category &&
          String(item.itemId) === String(prev.currentItemId)
      );

      if (existingIndex > -1) {
        const updatedItems = [...prev.detailItems];
        const target = updatedItems[existingIndex];
        const nextQuantity = target.quantity + quantity;

        updatedItems[existingIndex] = {
          ...target,
          quantity: nextQuantity,
          total: target.price * nextQuantity,
        };

        return {
          ...prev,
          detailItems: updatedItems,
          currentQuantity: "1",
        };
      }

      const newItem = {
        rowId: Date.now() + Math.floor(Math.random() * 1000),
        category: prev.category,
        itemId: selectedItem.id,
        name: selectedItem.name,
        price: selectedItem.price,
        unit: selectedItem.unit,
        quantity,
        total: selectedItem.price * quantity,
      };

      return {
        ...prev,
        detailItems: [...prev.detailItems, newItem],
        currentQuantity: "1",
      };
    });
  };

  const handleRemoveAddedItem = (rowId) => {
    setRequestForm((prev) => ({
      ...prev,
      detailItems: prev.detailItems.filter((item) => item.rowId !== rowId),
    }));
  };

  
const handleCreateRequest = async (event) => {
  event.preventDefault();

  if (!currentUser) {
    openModal({
      title: "로그인 필요",
      message: "로그인 후 이용해 주세요.",
    });
    return;
  }

  if (!requestForm.address.trim() || !requestForm.requestDate || !requestForm.category) {
    openModal({
      title: "입력 확인",
      message: "주소, 희망 일정, 카테고리를 입력해 주세요.",
    });
    return;
  }

  if (requestForm.detailItems.length === 0) {
    openModal({
      title: "입력 확인",
      message: "세부 항목을 1개 이상 추가해 주세요.",
    });
    return;
  }

  const totalPrice = requestForm.detailItems.reduce(
    (sum, item) => sum + item.total,
    0
  );

  const fullAddress = [
    requestForm.address.trim(),
    requestForm.detailAddress.trim(),
  ]
    .filter(Boolean)
    .join(" ");

const newRequest = {
  user_id: currentUser.login_id || currentUser.id,
  customer_name: currentUser.companyName,
  company_name: currentUser.companyName,
  phone: currentUser.phone || "",
  address: fullAddress,
  request_date: requestForm.requestDate,
  request_time: "",
  items: requestForm.detailItems,
  memo: requestForm.memo.trim(),
  supply_amount: totalPrice,
  vat_amount: Math.floor(totalPrice * 0.1),
  total_amount: totalPrice + Math.floor(totalPrice * 0.1),
  status: "requested",
  status_label: "요청접수",
};

try {
  console.log("요청 저장 시작", newRequest);

  const { data: insertedData, error } = await supabase
    .from("requests")
    .insert([newRequest])
    .select();

  console.log("insert 결과", insertedData);
  console.log("insert 에러", error);

  if (error) throw error;

  openModal({
    title: "일정 요청 완료",
    message: "일정 요청이 등록되었습니다.",
  });

  if (insertedData?.length) {
    setRequests((prev) => [normalizeRequestRow(insertedData[0]), ...prev]);
  } else {
    const data = await fetchRequestsFromDB();
    setRequests(data);
  }

  const resetOptions = demolitionData[firstCategory] || [];
  setRequestForm({
    address: "",
    detailAddress: "",
    requestDate: "",
    category: firstCategory,
    currentItemId: resetOptions[0] ? String(resetOptions[0].id) : "",
    currentQuantity: "1",
    detailItems: [],
    memo: "",
  });
} catch (error) {
  console.error("요청 저장 실패", error);
  openModal({
    title: "저장 실패",
    message: `DB 저장 중 오류: ${error.message || error}`,
  });
}
};

  const handleApproveUser = async (userOrId) => {
    const targetUser =
      typeof userOrId === "object"
        ? userOrId
        : users.find(
            (user) =>
              String(user.dbId || user.id) === String(userOrId) ||
              String(user.login_id || user.id) === String(userOrId)
          );

    if (!targetUser) {
      openModal({
        title: "회원 확인",
        message: "승인할 회원 정보를 찾을 수 없습니다.",
      });
      return;
    }

    try {
      const matchColumn = targetUser.dbId ? "id" : "login_id";
      const matchValue = targetUser.dbId || targetUser.login_id || targetUser.id;

      const { error } = await supabase
        .from("users")
        .update({ approved: true })
        .eq(matchColumn, matchValue);

      if (error) throw error;

      await fetchUsersFromDB();

      openModal({
        title: "회원 승인 완료",
        message: "회원 승인 처리가 완료되었습니다.",
      });
    } catch (error) {
      console.error("회원 승인 실패", error);
      openModal({
        title: "회원 승인 실패",
        message: `회원 승인 중 오류: ${error.message || error}`,
      });
    }
  };

  const updateRequestStatus = async (requestId, status, extraFields = {}) => {
    const normalizedStatus = normalizeStatus(status);
    const nextLabel = statusToLabel(normalizedStatus);

    const payload = {
      status: normalizedStatus,
      status_label: nextLabel,
      ...extraFields,
    };

    const { error } = await supabase
      .from("requests")
      .update(payload)
      .eq("id", requestId);

    if (error) {
      console.error("요청 상태 업데이트 실패", error);
      openModal({
        title: "DB 저장 실패",
        message: `상태 저장 중 오류: ${error.message || error}`,
      });
      return false;
    }

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? normalizeRequestRow({
              ...request,
              ...payload,
            })
          : request
      )
    );

    return true;
  };

  const handleUserCancelRequest = async (requestId) => {
    const confirmed = window.confirm("일정을 취소하시겠습니까?");
    if (!confirmed) return;

    const saved = await updateRequestStatus(requestId, "cancelled");

    if (!saved) return;

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              cancelAcknowledged: false,
              cancelledAt: new Date().toISOString(),
            }
          : request
      )
    );

    setActiveDetailOpenId((prev) => (prev === requestId ? null : prev));
    setServiceDetailOpenId((prev) => (prev === requestId ? null : prev));

    setShowServiceHistory(true);

    openModal({
      title: "일정취소 완료",
      message: "일정이 취소되었습니다.",
    });
  };

  const handleAdminCancelAcknowledge = async (requestId) => {
    const confirmed = window.confirm("일정취소를 확인 처리하시겠습니까?");
    if (!confirmed) return;

    const saved = await updateRequestStatus(requestId, "cancelled", {
      cancel_acknowledged: true,
    });

    if (!saved) return;

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              cancelAcknowledged: true,
            }
          : request
      )
    );

    openModal({
      title: "취소확인 완료",
      message: "일정취소 확인 처리가 완료되었습니다.",
    });
  };

  const sendKakaoNotification = async (request) => {
    const message = buildKakaoMessage(request);

    if (window.Kakao && KAKAO_JS_KEY) {
      try {
        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(KAKAO_JS_KEY);
        }

        window.Kakao.Share.sendDefault({
          objectType: "text",
          text: message,
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        });

        return { success: true, mode: "sdk" };
      } catch (error) {
        console.error("카카오 SDK 발송 실패", error);
      }
    }

    return { success: true, mode: "mock" };
  };

  const handleConfirmRequest = async (requestId) => {
    const targetRequest = requests.find((request) => request.id === requestId);
    if (!targetRequest) return;

    const saved = await updateRequestStatus(requestId, "confirmed");
    if (!saved) return;

    const kakaoResult = await sendKakaoNotification({
      ...targetRequest,
      status: "confirmed",
    });

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              pdfReady: true,
              kakaoSent: kakaoResult.success,
            }
          : request
      )
    );

    openModal({
      title: "확정 완료",
      message:
        kakaoResult.mode === "sdk"
          ? [
              "DB 저장과 확정 처리가 완료되었습니다.",
              "카카오 발송이 실행되었고 PDF 출력이 가능합니다.",
            ]
          : [
              "DB 저장과 확정 처리가 완료되었습니다.",
              "PDF 출력이 가능합니다.",
              "현재는 카카오 자동발송 연동 준비형 상태로 표시됩니다.",
            ],
    });
  };

  const openSettlementEditor = (request) => {
    const baseItems =
      request.actualDetailItems && request.actualDetailItems.length > 0
        ? request.actualDetailItems
        : request.detailItems;

    const baseCategory = baseItems[0]?.category || categoryList[0] || "";
    const baseOptions = demolitionData[baseCategory] || [];

    setSettlementDrafts((prev) => ({
      ...prev,
      [request.id]: {
        category: baseCategory,
        currentItemId: baseOptions[0] ? String(baseOptions[0].id) : "",
        currentQuantity: "1",
        actualItems: cloneItems(baseItems),
      },
    }));
  };

  const closeSettlementEditor = (requestId) => {
    setSettlementDrafts((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  };

  const updateSettlementDraftField = (requestId, field, value) => {
    setSettlementDrafts((prev) => {
      const draft = prev[requestId];
      if (!draft) return prev;

      if (field === "category") {
        const nextOptions = demolitionData[value] || [];
        return {
          ...prev,
          [requestId]: {
            ...draft,
            category: value,
            currentItemId: nextOptions[0] ? String(nextOptions[0].id) : "",
            currentQuantity: "1",
          },
        };
      }

      if (field === "currentQuantity") {
        return {
          ...prev,
          [requestId]: {
            ...draft,
            currentQuantity: sanitizeQuantityInput(value),
          },
        };
      }

      return {
        ...prev,
        [requestId]: {
          ...draft,
          [field]: value,
        },
      };
    });
  };

  const increaseSettlementQuantity = (requestId) => {
    setSettlementDrafts((prev) => {
      const draft = prev[requestId];
      if (!draft) return prev;

      return {
        ...prev,
        [requestId]: {
          ...draft,
          currentQuantity: String(getSafeQuantity(draft.currentQuantity) + 1),
        },
      };
    });
  };

  const decreaseSettlementQuantity = (requestId) => {
    setSettlementDrafts((prev) => {
      const draft = prev[requestId];
      if (!draft) return prev;

      return {
        ...prev,
        [requestId]: {
          ...draft,
          currentQuantity: String(Math.max(1, getSafeQuantity(draft.currentQuantity) - 1)),
        },
      };
    });
  };

  const handleAddSettlementItem = (requestId) => {
    const draft = settlementDrafts[requestId];
    if (!draft) return;

    const options = demolitionData[draft.category] || [];
    const selectedItem = options.find(
      (item) => String(item.id) === String(draft.currentItemId)
    );
    const quantity = getSafeQuantity(draft.currentQuantity);

    if (!selectedItem) {
      openModal({
        title: "정산 항목 확인",
        message: "정산할 세부 항목을 선택해 주세요.",
      });
      return;
    }

    setSettlementDrafts((prev) => {
      const currentDraft = prev[requestId];
      if (!currentDraft) return prev;

      const existingIndex = currentDraft.actualItems.findIndex(
        (item) =>
          item.category === currentDraft.category &&
          String(item.itemId) === String(currentDraft.currentItemId)
      );

      let nextItems = [...currentDraft.actualItems];

      if (existingIndex > -1) {
        const target = nextItems[existingIndex];
        const nextQuantity = target.quantity + quantity;
        nextItems[existingIndex] = {
          ...target,
          quantity: nextQuantity,
          total: target.price * nextQuantity,
        };
      } else {
        nextItems.push({
          rowId: Date.now() + Math.floor(Math.random() * 1000),
          category: currentDraft.category,
          itemId: selectedItem.id,
          name: selectedItem.name,
          price: selectedItem.price,
          unit: selectedItem.unit,
          quantity,
          total: selectedItem.price * quantity,
        });
      }

      return {
        ...prev,
        [requestId]: {
          ...currentDraft,
          actualItems: nextItems,
          currentQuantity: "1",
        },
      };
    });
  };

  const handleRemoveSettlementItem = (requestId, rowId) => {
    setSettlementDrafts((prev) => {
      const draft = prev[requestId];
      if (!draft) return prev;

      return {
        ...prev,
        [requestId]: {
          ...draft,
          actualItems: draft.actualItems.filter((item) => item.rowId !== rowId),
        },
      };
    });
  };

  const handleSaveSettlement = async (requestId) => {
    const draft = settlementDrafts[requestId];
    if (!draft) return;

    const nextItems = cloneItems(draft.actualItems);
    const nextTotal = calculateTotal(nextItems);
    const nextAmounts = calculateAmounts(nextItems);

    const saved = await updateRequestStatus(requestId, "confirmed", {
      actual_detail_items: nextItems,
      settled_total_price: nextTotal,
      supply_amount: nextAmounts.supplyAmount,
      vat_amount: nextAmounts.vat,
      total_amount: nextAmounts.totalAmount,
      settled_at: new Date().toISOString(),
    });

    if (!saved) return;

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? normalizeRequestRow({
              ...request,
              actual_detail_items: nextItems,
              settled_total_price: nextTotal,
              supply_amount: nextAmounts.supplyAmount,
              vat_amount: nextAmounts.vat,
              total_amount: nextAmounts.totalAmount,
              settled_at: new Date().toISOString(),
              status: "confirmed",
              status_label: statusToLabel("confirmed"),
            })
          : request
      )
    );

    closeSettlementEditor(requestId);
    openModal({
      title: "정산 저장 완료",
      message: "정산 내역이 저장되었습니다.",
    });
  };

  const handleCompleteRequest = async (requestId) => {
    const draft = settlementDrafts[requestId];
    const targetRequest = requests.find((request) => request.id === requestId);
    if (!targetRequest) return;

    const finalItems = draft
      ? cloneItems(draft.actualItems)
      : cloneItems(
          targetRequest.actualDetailItems?.length
            ? targetRequest.actualDetailItems
            : targetRequest.detailItems
        );

    const finalTotal = calculateTotal(finalItems);
    const finalAmounts = calculateAmounts(finalItems);
    const saved = await updateRequestStatus(requestId, "completed", {
      actual_detail_items: finalItems,
      settled_total_price: finalTotal,
      supply_amount: finalAmounts.supplyAmount,
      vat_amount: finalAmounts.vat,
      total_amount: finalAmounts.totalAmount,
      settled_at: new Date().toISOString(),
      pdf_ready: true,
    });

    if (!saved) return;

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? normalizeRequestRow({
              ...request,
              actual_detail_items: finalItems,
              settled_total_price: finalTotal,
              supply_amount: finalAmounts.supplyAmount,
              vat_amount: finalAmounts.vat,
              total_amount: finalAmounts.totalAmount,
              settled_at: new Date().toISOString(),
              pdf_ready: true,
              status: "completed",
              status_label: statusToLabel("completed"),
            })
          : request
      )
    );

    closeSettlementEditor(requestId);
    setCompletedDetailOpenId(requestId);
    openModal({
      title: "공사완료",
      message: "공사완료 리스트로 이동 저장되었습니다.",
    });
  };

  const handlePrintPdf = (request) => {
    const requestStatus = normalizeStatus(request.status);

    if (!["confirmed", "completed"].includes(requestStatus)) {
      openModal({
        title: "PDF 출력",
        message: "확정 또는 공사완료 상태에서 PDF 출력이 가능합니다.",
      });
      return;
    }

    const pdfItems =
      requestStatus === "completed" && request.actualDetailItems?.length
        ? request.actualDetailItems
        : request.detailItems;

    const { supplyAmount, vat, totalAmount } = calculateAmounts(pdfItems);

    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      openModal({
        title: "팝업 차단",
        message: "팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.",
      });
      return;
    }

    const detailRows = pdfItems
      .map(
        (item, index) => `
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;text-align:center;">${index + 1}</td>
            <td style="padding:10px;border:1px solid #d1d5db;">[${item.category}] ${item.name}</td>
            <td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${formatNumber(item.price)}원</td>
            <td style="padding:10px;border:1px solid #d1d5db;text-align:center;">${item.quantity}${item.unit}</td>
            <td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${formatNumber(item.total)}원</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>클린철거 일정확정서</title>
          <style>
            body { font-family: Arial, "Noto Sans KR", sans-serif; padding: 32px; color: #111827; }
            h1 { margin: 0 0 24px; font-size: 28px; }
            .meta { margin-bottom: 24px; line-height: 1.8; }
            .box { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            .status { display: inline-block; padding: 6px 10px; border-radius: 999px; background:#dcfce7; color:#166534; font-weight:700; }
            .total-box { width: 320px; margin: 24px 0 0 auto; border: 1px solid #d1d5db; border-radius: 12px; padding: 14px 16px; }
            .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 16px; padding: 6px 0; }
            .total-row + .total-row { border-top: 1px solid #e5e7eb; }
            .grand-total { font-size: 22px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>클린철거 일정확정서</h1>

          <div class="meta">
            <div><strong>업체명:</strong> ${request.companyName}</div>
            <div><strong>현장주소:</strong> ${request.address}</div>
            <div><strong>일정:</strong> ${formatDate(request.requestDate)}</div>
            <div><strong>상태:</strong> <span class="status">${getStatusLabel(request.status)}</span></div>
          </div>

          <div class="box">
            <strong>${requestStatus === "completed" ? "정산 항목" : "확정 항목"}</strong>
            <table>
              <thead>
                <tr>
                  <th style="padding:10px;border:1px solid #d1d5db;">No</th>
                  <th style="padding:10px;border:1px solid #d1d5db;">항목명</th>
                  <th style="padding:10px;border:1px solid #d1d5db;">단가</th>
                  <th style="padding:10px;border:1px solid #d1d5db;">수량</th>
                  <th style="padding:10px;border:1px solid #d1d5db;">금액</th>
                </tr>
              </thead>
              <tbody>
                ${detailRows}
              </tbody>
            </table>
          </div>

          ${
            request.memo
              ? `<div class="box"><strong>요청사항</strong><div style="margin-top:8px;">${request.memo}</div></div>`
              : ""
          }

          <div class="total-box">
            <div class="total-row">
              <span>공급가액</span>
              <strong>${formatNumber(supplyAmount)}원</strong>
            </div>
            <div class="total-row">
              <span>부가세</span>
              <strong>${formatNumber(vat)}원</strong>
            </div>
            <div class="total-row grand-total">
              <span>총금액</span>
              <strong>${formatNumber(totalAmount)}원</strong>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleAddPriceItem = async (event) => {
    event.preventDefault();

    const category = adminPriceForm.category;
    const name = adminPriceForm.name.trim();
    const price = Number(adminPriceForm.price);
    const unit = adminPriceForm.unit.trim();

    if (!category || !name || !price || !unit) {
      openModal({
        title: "단가표 입력 확인",
        message: "카테고리, 항목명, 단가, 단위를 모두 입력해 주세요.",
      });
      return;
    }

    const matchedCategory = categoryRecords.find((item) => item.name === category);

    if (!matchedCategory) {
      openModal({
        title: "카테고리 확인",
        message: "선택한 카테고리를 DB에서 찾지 못했습니다.",
      });
      return;
    }

    const currentItems = demolitionData[category] || [];
    const nextSortOrder =
      currentItems.length > 0
        ? Math.max(...currentItems.map((item) => Number(item.sort_order || 0))) + 1
        : 1;

    try {
      const { error } = await supabase.from("price_items").insert({
        category_name: matchedCategory.name,
        item_name: name,
        price,
        unit,
        sort_order: nextSortOrder,
        is_active: true,
      });

      if (error) throw error;

      setAdminPriceForm((prev) => ({
        ...prev,
        name: "",
        price: "",
        unit: "",
      }));

      await fetchCatalog();

      openModal({
        title: "단가표 저장 완료",
        message: "DB에 세부 항목이 추가되었습니다.",
      });
    } catch (error) {
      console.error("단가표 항목 추가 실패", error);
      openModal({
        title: "단가표 저장 실패",
        message: "DB 저장 중 오류가 발생했습니다.",
      });
    }
  };

  const handleDeletePriceItem = async (category, itemId) => {
    const confirmed = window.confirm("선택한 항목을 삭제하시겠습니까?");
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("price_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      await fetchCatalog();
    } catch (error) {
      console.error("단가표 항목 삭제 실패", error);
      openModal({
        title: "단가표 삭제 실패",
        message: "DB 삭제 중 오류가 발생했습니다.",
      });
    }
  };

  const handleSearchCompleted = () => {
    setCompletedPage(1);
    setCompletedSearchKeyword(completedSearchInput.trim());
  };

  const handleTogglePaymentCompleted = async (request) => {
    const nextValue = !request.paymentCompleted;

    if (request.paymentCompleted) {
      const confirmed = window.confirm("입금완료 해제 하시겠습니까?");
      if (!confirmed) return;
    }

    const applyLocalPaymentState = () => {
      setRequests((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? {
                ...item,
                paymentCompleted: nextValue,
              }
            : item
        )
      );
    };

    const { error } = await supabase
      .from("requests")
      .update({
        payment_completed: nextValue,
      })
      .eq("id", request.id);

    if (error) {
      const errorMessage = String(error?.message || error || "");
      const missingColumn =
        errorMessage.includes("payment_completed") &&
        (errorMessage.includes("schema cache") ||
          errorMessage.includes("does not exist") ||
          errorMessage.includes("Could not find") ||
          errorMessage.includes("column"));

      if (missingColumn) {
        console.warn(
          "payment_completed 컬럼이 없어 화면 상태만 반영합니다.",
          error
        );
        applyLocalPaymentState();
        return;
      }

      console.error("입금완료 상태 업데이트 실패", error);
      openModal({
        title: "저장 실패",
        message: `입금완료 상태 저장 중 오류: ${error.message || error}`,
      });
      return;
    }

    applyLocalPaymentState();
  };

  const renderRequestItems = (items, compact = false) => {
    const rows = Array.isArray(items) ? items : [];

    if (!rows.length) {
      return <div className="simple-detail-empty">공사 목록 없음</div>;
    }

    return (
      <div className={compact ? "simple-detail-list compact" : "simple-detail-list"}>
        {rows.map((item, index) => (
          <div
            key={`${item.rowId || item.itemId || index}-${index}`}
            className="simple-detail-row"
          >
            <div className="simple-detail-name">{item.name}</div>
            <div className="simple-detail-qty">
              {item.quantity}
              {item.unit}
            </div>
            <div className="simple-detail-amount">{formatNumber(item.total)}원</div>
          </div>
        ))}
      </div>
    );
  };

  const getRequestDisplayItems = (request) =>
    request.actualDetailItems?.length ? request.actualDetailItems : request.detailItems;

  const getRequestAmount = (request) => {
    return getDisplayAmountFromRequest(request);
  };

  const canCancelRequest = (request) =>
    ["requested", "on_hold", "confirmed"].includes(normalizeStatus(request.status));

  const renderUserRequestCard = (request, options = {}) => {
    const {
      isServiceHistory = false,
      detailOpenId = null,
      onToggleDetail = () => {},
    } = options;

    const displayItems = getRequestDisplayItems(request);
    const isDetailOpen = detailOpenId === request.id;
    const status = normalizeStatus(request.status);
    const isCancelled = status === "cancelled";

    return (
      <div
        className={`completed-card compact-completed-card completed-compact-card user-history-card ${
          isCancelled ? "user-cancelled-card" : ""
        }`}
        key={request.id}
      >
        <div className="completed-compact-head user-history-head">
          <div className="completed-compact-info">
            <div className="user-history-title-row">
              <div className="completed-company-name">{request.companyName}</div>
              <div className="user-history-badges">
                <span className={`status-badge ${status}`}>{getStatusLabel(status)}</span>
                {!isServiceHistory && canCancelRequest(request) && (
                  <button
                    type="button"
                    className="small-btn user-cancel-chip"
                    onClick={() => handleUserCancelRequest(request.id)}
                  >
                    일정취소
                  </button>
                )}
              </div>
            </div>
            <div className="completed-address-text">{request.address}</div>
          </div>
        </div>

        <div className="completed-meta-row user-history-meta">
          <div className="completed-meta-box">
            <span>작업일정</span>
            <strong>{formatDate(request.requestDate)}</strong>
          </div>
          <div className="completed-meta-box total">
            <span>{isServiceHistory ? "정산금액" : "정산금액"}</span>
            <strong>{formatNumber(getRequestAmount(request))}원</strong>
          </div>
        </div>

        <div className="user-history-detail-row">
          <button
            className="secondary-btn small-btn completed-action-btn user-history-detail-btn"
            onClick={() => onToggleDetail(request.id)}
          >
            {isDetailOpen ? "상세닫기" : "상세보기"}
          </button>
        </div>

        {isDetailOpen && (
          <div className="completed-detail-panel compact-completed-detail">
            {renderRequestItems(displayItems)}
          </div>
        )}
      </div>
    );
  };

  const getCompletedSummaryText = (items = []) => {
    if (!items.length) return "항목 없음";

    const firstItem = items[0];
    const firstText = `[${firstItem.category}] ${firstItem.name} ${firstItem.quantity}${firstItem.unit}`;

    if (items.length === 1) return firstText;

    return `${firstText} 외 ${items.length - 1}건`;
  };

  return (
    <div className="app">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="eyebrow">CLEAN DEMOLITION</p>
            <h1>Clean Demo Manager</h1>
            <p className="page-description">
              철거 카테고리와 일정 선택 후 &quot;일정요청하기&quot; 버튼 클릭!!
              스케줄 확인 후 확정메세지 통보드립니다~
            </p>
          </div>

          <div className="top-actions">
            {currentUser ? (
              <>
                <div className="user-badge">
                  <div className="user-badge-top">
                    <strong>{currentUser.id}</strong>
                    <span
                      className={`user-state-badge ${
                        currentUser.approved ? "approved" : "pending"
                      }`}
                    >
                      {currentUser.approved ? "승인완료" : "인증대기"}
                    </span>
                  </div>
                  <span className="user-company-name">{currentUser.companyName}</span>
                </div>

                <div className="action-stack">
                  <button className="secondary-btn action-btn" onClick={handleLogout}>
                    로그아웃
                  </button>
                  {!isAdmin && (
                    <button
                      className={`secondary-btn small-btn action-btn my-toggle-btn ${
                        showMyBox ? "open" : ""
                      }`}
                      type="button"
                      onClick={() => {
                        setShowMyBox((prev) => {
                          const next = !prev;
                          if (next) {
                            setMyPage(1);
                          } else {
                            setMyDetailOpenId(null);
                          }
                          return next;
                        });
                      }}
                    >
                      My
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="secondary-btn small-btn action-btn"
                      onClick={() => setShowApprovedUsersPopup(true)}
                    >
                      승인완료회원
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="auth-top-buttons single-auth-button">
                <button
                  className={`secondary-btn action-btn auth-toggle-btn ${showAuthPanel ? "open" : ""}`}
                  type="button"
                  onClick={() => {
                    setShowAuthPanel((prev) => {
                      const next = !prev;
                      if (next) {
                        setAuthMode("login");
                      }
                      return next;
                    });
                  }}
                >
                  로그인
                </button>
              </div>
            )}
          </div>
        </header>

        {(isCatalogLoading || catalogError) && (
          <section className="section-card" style={{ marginBottom: "20px" }}>
            {isCatalogLoading ? (
              <p className="section-description">
                카테고리와 세부항목을 DB에서 불러오는 중입니다.
              </p>
            ) : (
              <p className="section-description" style={{ color: "#b91c1c" }}>
                {catalogError}
              </p>
            )}
          </section>
        )}

        {!currentUser && (
          <>
            <div
              className={`auth-side-overlay ${showAuthPanel ? "open" : ""}`}
              onClick={() => {
                setShowAuthPanel(false);
                setAuthMode("login");
              }}
            />
            <aside
              className={`section-card auth-side-panel ${showAuthPanel ? "open" : ""}`}
              aria-hidden={!showAuthPanel}
            >
              <div className="card-header my-card-header auth-side-header">
                <div>
                  <h2>{authMode === "signup" ? "회원가입" : "로그인"}</h2>
                </div>
              </div>

              {authMode === "signup" ? (
                <form className="form-grid" onSubmit={handleSignup}>
                  <div className="input-group">
                    <label>회사명</label>
                    <input
                      type="text"
                      value={signupForm.companyName}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          companyName: e.target.value,
                        }))
                      }
                      placeholder="회사명을 입력해 주세요"
                    />
                  </div>

                  <div className="input-group">
                    <label>휴대전화</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={signupForm.phone}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          phone: e.target.value.replace(/[^\d-]/g, ""),
                        }))
                      }
                      placeholder="휴대전화 번호를 입력해 주세요"
                    />
                  </div>

                  <div className="input-group">
                    <label>아이디</label>
                    <input
                      type="text"
                      value={signupForm.id}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          id: e.target.value,
                        }))
                      }
                      placeholder="아이디를 입력해 주세요"
                    />
                  </div>

                  <div className="input-group">
                    <label>비밀번호</label>
                    <input
                      type="password"
                      value={signupForm.password}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="비밀번호를 입력해 주세요"
                    />
                  </div>

                  <div className="input-group">
                    <label>비밀번호 확인</label>
                    <input
                      type="password"
                      value={signupForm.confirmPassword}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      placeholder="비밀번호를 다시 입력해 주세요"
                    />
                  </div>

                  <div className="input-group">
                    <label>첨부자료 (사업자등록증)</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          businessFile: e.target.files?.[0] || null,
                        }))
                      }
                    />
                    <span className="auth-file-guide">
                      첨부자료는 선택사항이며, 업로드하지 않아도 가입 가능합니다.
                    </span>
                  </div>

                  <button type="submit" className="primary-btn full-width" disabled={!currentUser}>
                    회원가입하기
                  </button>
                </form>
              ) : (
                <form className="form-grid" onSubmit={handleLogin}>
                  <div className="input-group">
                    <label>아이디</label>
                    <input
                      type="text"
                      value={loginForm.id}
                      onChange={(e) =>
                        setLoginForm((prev) => ({
                          ...prev,
                          id: e.target.value,
                        }))
                      }
                      placeholder="아이디를 입력해 주세요"
                    />
                  </div>

                  <div className="input-group">
                    <label>비밀번호</label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) =>
                        setLoginForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="비밀번호를 입력해 주세요"
                    />
                  </div>

                  <div className="auth-inline-actions">
                    <button type="submit" className="primary-btn">
                      로그인
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setAuthMode("signup")}
                    >
                      회원가입
                    </button>
                  </div>
                </form>
              )}
            </aside>
          </>
        )}

        {!isAdmin && (
          <div className="dashboard-grid user-dashboard-layout">
            <section className="section-card">
              {!currentUser ? (
                <div className="notice-box login-required-notice">
                  로그인 후 일정요청 기능을 이용할 수 있습니다.
                </div>
              ) : (
                !currentUser.approved && (
                  <div className="notice-box">
                    일정 요청 후 관리자 승인 시 일정확정이 진행됩니다.
                  </div>
                )
              )}

              <form className="form-grid" onSubmit={handleCreateRequest}>
                <h3>일정요청하기</h3>

                <div className="input-group">
                  <label>현장 주소</label>
                  <div className="address-row">
                    <input
                      type="text"
                      value={requestForm.address}
                      onChange={(e) =>
                        setRequestForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      placeholder="주소검색 버튼을 눌러 주세요"
                      readOnly
                    />
                    <button
                      type="button"
                      className="secondary-btn address-btn"
                      onClick={handleAddressSearch}
                      disabled={!currentUser}
                    >
                      주소검색
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label>상세 주소</label>
                  <input
                    type="text"
                    value={requestForm.detailAddress}
                    disabled={!currentUser}
                    onChange={(e) =>
                      setRequestForm((prev) => ({
                        ...prev,
                        detailAddress: e.target.value,
                      }))
                    }
                    placeholder="상세 주소를 입력해 주세요"
                  />
                </div>

                <div className="input-group">
                  <label>희망 일정</label>
                  <input
                    type="date"
                    value={requestForm.requestDate}
                    disabled={!currentUser}
                    onChange={(e) =>
                      setRequestForm((prev) => ({
                        ...prev,
                        requestDate: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="input-group">
                  <label>철거 카테고리</label>
                  <select
                    value={requestForm.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    disabled={!currentUser}
                  >
                    {categoryList.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="detail-section">
                  <label className="detail-section-label">세부내용 선택</label>

                  <div className="detail-add-row">
                    <select
                      value={requestForm.currentItemId}
                      disabled={!currentUser}
                      onChange={(e) =>
                        setRequestForm((prev) => ({
                          ...prev,
                          currentItemId: e.target.value,
                        }))
                      }
                    >
                      {currentCategoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} / {formatNumber(option.price)}원 / {option.unit}
                        </option>
                      ))}
                    </select>

                    <QuantityControl
                      value={requestForm.currentQuantity}
                      onChange={(e) => updateRequestQuantityInput(e.target.value)}
                      onIncrease={increaseRequestQuantity}
                      onDecrease={decreaseRequestQuantity}
                      disabled={!currentUser}
                    />

                    <button
                      type="button"
                      className="primary-btn small-btn add-item-btn"
                      onClick={handleAddCurrentItem}
                      disabled={!currentUser}
                    >
                      항목 추가
                    </button>
                  </div>

                  {requestForm.detailItems.length === 0 ? (
                    <div className="empty-box">
                      선택한 항목이 없습니다. 세부내용 선택 후 추가해 주세요.
                    </div>
                  ) : (
                    <div className="added-item-list">
                      {requestForm.detailItems.map((item) => (
                        <div className="added-item-row" key={item.rowId}>
                          <div className="added-item-main">
                            <strong>
                              [{item.category}] {item.name}
                            </strong>
                            <span>
                              {formatNumber(item.price)}원 / {item.unit} · 수량 {item.quantity}
                            </span>
                          </div>
                          <div className="added-item-right">
                            <div className="added-item-total">
                              {formatNumber(item.total)}원
                            </div>
                            <button
                              type="button"
                              className="danger-btn small-btn"
                              onClick={() => handleRemoveAddedItem(item.rowId)}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <label>요청사항</label>
                  <textarea
                    rows="2"
                    className="memo-textarea"
                    value={requestForm.memo}
                    disabled={!currentUser}
                    onChange={(e) =>
                      setRequestForm((prev) => ({
                        ...prev,
                        memo: e.target.value,
                      }))
                    }
                    placeholder="ex) 엘레베이터 사용가능, 복도 좁음, 주말 작업 가능"
                  />
                </div>

                <div className="estimate-box">
                  <span>예상 합계금액</span>
                  <strong>{formatNumber(requestTotalPrice)}원</strong>
                </div>

                <button type="submit" className="primary-btn full-width">
                  일정요청하기
                </button>
              </form>
            </section>
          </div>
        )}

        {currentUser && isAdmin && (
          <div className="admin-layout">
            <section className="section-card">
              <div className="card-header">
                <div>
                  <h2>회원 승인 관리</h2>
                  <p className="section-description">
                    신규 회원 승인 여부를 관리합니다.
                  </p>
                </div>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="empty-box compact-empty">
                  신규 승인 요청 회원이 없습니다.
                </div>
              ) : (
                <div className="simple-list">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="simple-item">
                      <div>
                        <strong>{user.id}</strong>
                        <p>
                          {user.companyName}
                          {user.phone ? ` / ${user.phone}` : ""}
                        </p>
                      </div>
                      <button
                        className="primary-btn small-btn"
                        onClick={() => handleApproveUser(user)}
                      >
                        승인
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="section-card">
              <div className="admin-tab-bar">
                <button
                  className={`admin-tab-btn ${adminTab === "request" ? "active" : ""}`}
                  onClick={() => setAdminTab("request")}
                >
                  일정요청관리
                </button>
                <button
                  className={`admin-tab-btn ${adminTab === "progress" ? "active" : ""}`}
                  onClick={() => setAdminTab("progress")}
                >
                  진행중인 일정
                </button>
                <button
                  className={`admin-tab-btn ${adminTab === "completed" ? "active" : ""}`}
                  onClick={() => setAdminTab("completed")}
                >
                  공사완료 리스트
                </button>
                <button
                  className={`admin-tab-btn ${adminTab === "company" ? "active" : ""}`}
                  onClick={() => setAdminTab("company")}
                >
                  업체별 현황
                </button>
              </div>

              {adminTab === "request" && (
                <>
                  <div className="card-header">
                    <div>
                      <h2>일정요청관리</h2>
                      <p className="section-description">
                        접수 / 보류 상태의 요청을 관리합니다.
                      </p>
                    </div>
                  </div>

                  {requestPagination.items.length === 0 ? (
                    <div className="empty-box">표시할 요청이 없습니다.</div>
                  ) : (
                    <div className="request-list">
                      {requestPagination.items.map((request) => (
                        <div className="request-card" key={request.id}>
                          <div className="request-top">
                            <div>
                              <h3>{request.companyName}</h3>
                              <p>{request.address}</p>
                            </div>
                            <span className={`status-badge ${request.status}`}>
                              {getStatusLabel(request.status)}
                            </span>
                          </div>

                          {renderRequestItems(request.detailItems)}

                          {request.memo && (
                            <div className="request-memo">요청사항: {request.memo}</div>
                          )}

                          <div className="request-summary-box admin-summary-box">
                            <div className="request-summary-item">
                              <span>일정</span>
                              <strong>{formatDate(request.requestDate)}</strong>
                            </div>
                            <div className="request-summary-item total">
                              <span>총금액</span>
                              <strong>{formatNumber(request.totalPrice)}원</strong>
                            </div>
                          </div>

                          <div className="status-actions">
                            <button
                              className="primary-btn small-btn"
                              onClick={() => handleConfirmRequest(request.id)}
                            >
                              확정
                            </button>
                            <button
                              className="danger-btn small-btn"
                              onClick={() => updateRequestStatus(request.id, "on_hold")}
                            >
                              보류
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Pagination
                    page={requestPagination.currentPage}
                    totalPages={requestPagination.totalPages}
                    onChange={setRequestPage}
                  />
                </>
              )}

              {adminTab === "progress" && (
                <>
                  <div className="card-header">
                    <div>
                      <h2>진행중인 일정</h2>
                      <p className="section-description">
                        확정 및 일정취소 건에 대해 정산/취소 상태를 관리합니다.
                      </p>
                    </div>
                  </div>

                  {progressPagination.items.length === 0 ? (
                    <div className="empty-box">진행중인 일정이 없습니다.</div>
                  ) : (
                    <div className="request-list">
                      {progressPagination.items.map((request) => {
                        const settlementDraft = settlementDrafts[request.id];
                        const settlementOptions =
                          demolitionData[settlementDraft?.category] || [];

                        return (
                          <div className="request-card" key={request.id}>
                            <div className="request-top">
                              <div>
                                <h3>{request.companyName}</h3>
                                <p>{request.address}</p>
                              </div>
                              <span className={`status-badge ${request.status}`}>
                                {getStatusLabel(request.status)}
                              </span>
                            </div>

                            {renderRequestItems(
                              request.actualDetailItems?.length
                                ? request.actualDetailItems
                                : request.detailItems
                            )}

                            {request.memo && (
                              <div className="request-memo">요청사항: {request.memo}</div>
                            )}

                            <div className="request-summary-box admin-summary-box">
                              <div className="request-summary-item">
                                <span>일정</span>
                                <strong>{formatDate(request.requestDate)}</strong>
                              </div>
                              <div className="request-summary-item total">
                                <span>현재금액</span>
                                <strong>
                                  {formatNumber(
                                    request.settledTotalPrice || request.totalPrice
                                  )}
                                  원
                                </strong>
                              </div>
                            </div>

                            <div className="status-actions">
                              {normalizeStatus(request.status) === "cancelled" ? (
                                <button
                                  type="button"
                                  className="danger-btn small-btn"
                                  onClick={() => handleAdminCancelAcknowledge(request.id)}
                                  disabled={request.cancelAcknowledged}
                                >
                                  {request.cancelAcknowledged ? "취소확인완료" : "일정취소 확인"}
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="secondary-btn small-btn"
                                    onClick={() => openSettlementEditor(request)}
                                  >
                                    정산하기
                                  </button>
                                  <button
                                    type="button"
                                    className="primary-btn small-btn"
                                    onClick={() => handleCompleteRequest(request.id)}
                                  >
                                    공사완료
                                  </button>
                                  <button
                                    className="secondary-btn small-btn"
                                    onClick={() => handlePrintPdf(request)}
                                  >
                                    PDF 출력
                                  </button>
                                </>
                              )}
                            </div>

                            {settlementDraft && normalizeStatus(request.status) !== "cancelled" && (
                              <div className="settlement-box">
                                <div className="settlement-header">
                                  <strong>정산 내역 편집</strong>
                                  <button
                                    type="button"
                                    className="secondary-btn small-btn"
                                    onClick={() => closeSettlementEditor(request.id)}
                                  >
                                    닫기
                                  </button>
                                </div>

                                <div className="detail-add-row settlement-add-row">
                                  <select
                                    value={settlementDraft.category}
                                    onChange={(e) =>
                                      updateSettlementDraftField(
                                        request.id,
                                        "category",
                                        e.target.value
                                      )
                                    }
                                  >
                                    {categoryList.map((category) => (
                                      <option key={category} value={category}>
                                        {category}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={settlementDraft.currentItemId}
                                    onChange={(e) =>
                                      updateSettlementDraftField(
                                        request.id,
                                        "currentItemId",
                                        e.target.value
                                      )
                                    }
                                  >
                                    {settlementOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.name} / {formatNumber(option.price)}원 /{" "}
                                        {option.unit}
                                      </option>
                                    ))}
                                  </select>

                                  <QuantityControl
                                    value={settlementDraft.currentQuantity}
                                    onChange={(e) =>
                                      updateSettlementDraftField(
                                        request.id,
                                        "currentQuantity",
                                        e.target.value
                                      )
                                    }
                                    onIncrease={() => increaseSettlementQuantity(request.id)}
                                    onDecrease={() => decreaseSettlementQuantity(request.id)}
                                  />

                                  <button
                                    type="button"
                                    className="primary-btn small-btn add-item-btn"
                                    onClick={() => handleAddSettlementItem(request.id)}
                                  >
                                    항목 추가
                                  </button>
                                </div>

                                {settlementDraft.actualItems.length === 0 ? (
                                  <div className="empty-box">정산 항목이 없습니다.</div>
                                ) : (
                                  <div className="added-item-list">
                                    {settlementDraft.actualItems.map((item) => (
                                      <div className="added-item-row" key={item.rowId}>
                                        <div className="added-item-main">
                                          <strong>
                                            [{item.category}] {item.name}
                                          </strong>
                                          <span>
                                            {formatNumber(item.price)}원 / {item.unit} · 수량{" "}
                                            {item.quantity}
                                          </span>
                                        </div>
                                        <div className="added-item-right">
                                          <div className="added-item-total">
                                            {formatNumber(item.total)}원
                                          </div>
                                          <button
                                            type="button"
                                            className="danger-btn small-btn"
                                            onClick={() =>
                                              handleRemoveSettlementItem(
                                                request.id,
                                                item.rowId
                                              )
                                            }
                                          >
                                            삭제
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="settlement-footer">
                                  <div className="settlement-total-box">
                                    정산 합계금액{" "}
                                    <strong>
                                      {formatNumber(
                                        calculateTotal(settlementDraft.actualItems)
                                      )}
                                      원
                                    </strong>
                                  </div>
                                  <div className="status-actions">
                                    <button
                                      type="button"
                                      className="secondary-btn small-btn"
                                      onClick={() => handleSaveSettlement(request.id)}
                                    >
                                      정산저장
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Pagination
                    page={progressPagination.currentPage}
                    totalPages={progressPagination.totalPages}
                    onChange={setProgressPage}
                  />
                </>
              )}

              {adminTab === "completed" && (
                <>
                  <div className="card-header">
                    <div>
                      <h2>공사완료 리스트</h2>
                      <p className="section-description">
                        완료 및 취소 건을 업체별로 검색하고 확인할 수 있습니다.
                      </p>
                    </div>
                  </div>

                  <div className="search-bar-row">
                    <input
                      type="text"
                      value={completedSearchInput}
                      onChange={(e) => setCompletedSearchInput(e.target.value)}
                      placeholder="업체명 검색"
                    />
                    <button
                      className="secondary-btn search-btn"
                      onClick={handleSearchCompleted}
                    >
                      🔍
                    </button>
                  </div>

                  {completedPagination.items.length === 0 ? (
                    <div className="empty-box">표시할 완료 건이 없습니다.</div>
                  ) : (
                    <div className="completed-list compact-completed-list">
                      {completedPagination.items.map((request) => {
                        const finalItems = request.actualDetailItems?.length
                          ? request.actualDetailItems
                          : request.detailItems;
                        const uniqueFinalItems = finalItems.filter((item, index, self) => {
                          const key = `${item.category || ""}-${item.name || ""}`;
                          return (
                            index ===
                            self.findIndex((target) => {
                              const targetKey = `${target.category || ""}-${target.name || ""}`;
                              return targetKey === key;
                            })
                          );
                        });
                        const isDetailOpen = completedDetailOpenId === request.id;

                        return (
                          <div
                            className="completed-card admin-completed-card compact-completed-card completed-compact-card"
                            key={request.id}
                          >
                            <div className="completed-compact-head user-history-head">
                              <div className="completed-compact-info">
                                <div className="completed-company-name">{request.companyName}</div>
                                <div className="completed-address-text">{request.address}</div>
                              </div>
                              <div className="user-history-badges">
                                <span className={`status-badge ${normalizeStatus(request.status)}`}>
                                  {getStatusLabel(request.status)}
                                </span>
                              </div>
                            </div>

                            <div className="completed-meta-row completed-meta-row-with-actions">
                              <div className="completed-meta-box">
                                <span>작업일정</span>
                                <strong>{formatDate(request.requestDate)}</strong>
                              </div>
                              <div className="completed-meta-box total">
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginBottom: "4px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="small-btn"
                                    style={{
                                      minWidth: "88px",
                                      background:
                                        normalizeStatus(request.status) === "cancelled"
                                          ? "#6b7280"
                                          : request.paymentCompleted
                                          ? "#ef4444"
                                          : "#3b82f6",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: "8px",
                                      padding: "6px 10px",
                                      cursor:
                                        normalizeStatus(request.status) === "cancelled"
                                          ? "default"
                                          : "pointer",
                                    }}
                                    onClick={() => {
                                      if (normalizeStatus(request.status) !== "cancelled") {
                                        handleTogglePaymentCompleted(request);
                                      }
                                    }}
                                  >
                                    {normalizeStatus(request.status) === "cancelled"
                                      ? "일정취소"
                                      : request.paymentCompleted
                                      ? "입금완료"
                                      : "입금대기"}
                                  </button>
                                  <span>
                                    {normalizeStatus(request.status) === "cancelled"
                                      ? "취소건"
                                      : "정산금액"}
                                  </span>
                                </div>
                                <strong>
                                  {formatNumber(
                                    normalizeStatus(request.status) === "cancelled"
                                      ? 0
                                      : request.settledTotalPrice || request.totalPrice
                                  )}원
                                </strong>
                              </div>
                              <div className="completed-action-stack horizontal">
                                <button
                                  className="secondary-btn small-btn completed-action-btn"
                                  onClick={() =>
                                    setCompletedDetailOpenId((prev) =>
                                      prev === request.id ? null : request.id
                                    )
                                  }
                                >
                                  {isDetailOpen ? "상세닫기" : "상세내용"}
                                </button>
                                <button
                                  className="secondary-btn small-btn completed-action-btn"
                                  onClick={() => handlePrintPdf(request)}
                                >
                                  PDF 출력
                                </button>
                              </div>
                            </div>

                            {isDetailOpen && (
                              <div className="completed-detail-panel compact-completed-detail">
                                {finalItems.length ? (
                                  renderRequestItems(finalItems)
                                ) : (
                                  <div className="completed-detail-item">공사 목록 없음</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Pagination
                    page={completedPagination.currentPage}
                    totalPages={completedPagination.totalPages}
                    onChange={setCompletedPage}
                  />
                </>
              )}

              {adminTab === "company" && (
                <>
                  <div className="card-header">
                    <div>
                      <h2>업체별 현황</h2>
                      <p className="section-description">
                        업체별 총 건수, 취소건수, 총금액, 입금액, 미수금액을 확인합니다.
                      </p>
                    </div>
                  </div>

                  {companySummaryList.length === 0 ? (
                    <div className="empty-box">업체별 현황 데이터가 없습니다.</div>
                  ) : (
                    <div className="request-list">
                      {companySummaryList.map((company) => (
                        <div className="request-card company-summary-card" key={company.companyName}>
                          <div className="request-top">
                            <div>
                              <h3>{company.companyName}</h3>
                            </div>
                          </div>

                          <div className="company-summary-grid">
                            <div className="company-box company-box-half">
                              <span>총건수</span>
                              <strong>{company.totalCount}건</strong>
                            </div>

                            <div className="company-box company-box-half company-box-muted">
                              <span>취소건수</span>
                              <strong>{company.cancelledCount}건</strong>
                            </div>

                            <div className="company-box company-box-inline">
                              <span>총금액</span>
                              <strong>{formatNumber(company.totalAmount)}원</strong>
                            </div>

                            <div className="company-box company-box-inline paid">
                              <span>입금액</span>
                              <strong>{formatNumber(company.paidAmount)}원</strong>
                            </div>

                            <div className="company-box company-box-inline unpaid">
                              <span>미수금액</span>
                              <strong>{formatNumber(company.unpaidAmount)}원</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}                </>
              )}
            </section>

            <section className="section-card">
              <div className="card-header">
                <div>
                  <h2>단가표 관리</h2>
                  <p className="section-description">
                    카테고리별 항목과 단가를 추가/삭제할 수 있습니다.
                  </p>
                </div>
              </div>

              <form className="price-form" onSubmit={handleAddPriceItem}>
                <select
                  value={adminPriceForm.category}
                  onChange={(e) =>
                    setAdminPriceForm((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                >
                  {categoryList.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={adminPriceForm.name}
                  onChange={(e) =>
                    setAdminPriceForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="항목명"
                />

                <input
                  type="number"
                  value={adminPriceForm.price}
                  onChange={(e) =>
                    setAdminPriceForm((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  placeholder="단가"
                />

                <input
                  type="text"
                  value={adminPriceForm.unit}
                  onChange={(e) =>
                    setAdminPriceForm((prev) => ({
                      ...prev,
                      unit: e.target.value,
                    }))
                  }
                  placeholder="단위"
                />

                <button type="submit" className="primary-btn">
                  추가
                </button>
              </form>

              <div className="price-board">
                {categoryList.map((category) => (
                  <div key={category} className="sub-card compact-sub-card">
                    <h3>{category}</h3>
                    <div className="price-list">
                      {(demolitionData[category] || []).map((item) => (
                        <div key={item.id} className="price-item compact-price-item">
                          <div>
                            <strong>{item.name}</strong>
                            <p>
                              {formatNumber(item.price)}원 / {item.unit}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="danger-btn small-btn"
                            onClick={() => handleDeletePriceItem(category, item.id)}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}


        {currentUser && !isAdmin && (
          <>
            <div
              className={`my-side-overlay ${showMyBox ? "open" : ""}`}
              onClick={() => {
                setShowMyBox(false);
                setMyDetailOpenId(null);
              }}
            />
            <aside
              className={`section-card my-side-panel ${showMyBox ? "open" : ""}`}
              aria-hidden={!showMyBox}
            >
              <div className="card-header my-card-header">
                <div>
                  <h2>My</h2>
                  <p className="section-description">
                    요청내역과 서비스내역을 한 번에 확인할 수 있습니다.
                  </p>
                </div>

                <div className="my-summary-chips">
                  <span className="my-summary-chip">전체 {myRequestSummary.total}건</span>
                  <span className="my-summary-chip">진행중 {myRequestSummary.active}건</span>
                  <span className="my-summary-chip">완료/취소 {myRequestSummary.history}건</span>
                </div>
              </div>

              <div className="my-collapse-body">
                {myRequests.length === 0 ? (
                  <div className="empty-box">등록된 요청이 없습니다.</div>
                ) : (
                  <>
                    <div className="completed-list compact-completed-list">
                      {myPagination.items.map((request) =>
                        renderUserRequestCard(request, {
                          isServiceHistory: ["completed", "cancelled"].includes(
                            normalizeStatus(request.status)
                          ),
                          detailOpenId: myDetailOpenId,
                          onToggleDetail: (requestId) =>
                            setMyDetailOpenId((prev) =>
                              prev === requestId ? null : requestId
                            ),
                        })
                      )}
                    </div>

                    <div className="my-pagination-wrap">
                      <Pagination
                        page={myPagination.currentPage}
                        totalPages={myPagination.totalPages}
                        onChange={setMyPage}
                      />
                    </div>
                  </>
                )}
              </div>
            </aside>
          </>
        )}

        {showApprovedUsersPopup && (
          <div
            className="popup-overlay"
            onClick={() => setShowApprovedUsersPopup(false)}
          >
            <div className="popup-card compact-popup-card" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header compact-popup-header">
                <h3>승인완료회원</h3>
                <button
                  type="button"
                  className="secondary-btn small-btn"
                  onClick={() => setShowApprovedUsersPopup(false)}
                >
                  닫기
                </button>
              </div>

              <div className="search-bar-row compact-search-row">
                <input
                  type="text"
                  value={approvedSearch}
                  onChange={(e) => setApprovedSearch(e.target.value)}
                  placeholder="아이디 / 회사명 / 연락처 검색"
                />
              </div>

              {approvedUsers.length === 0 ? (
                <div className="empty-box compact-empty">
                  승인완료된 회원이 없습니다.
                </div>
              ) : (
                <div className="simple-list popup-list">
                  {approvedUsers.map((user) => (
                    <div key={user.id} className="simple-item compact-simple-item">
                      <div>
                        <strong>{user.id}</strong>
                        <p>
                          {user.companyName}
                          {user.phone ? ` / ${user.phone}` : ""}
                        </p>
                      </div>
                      <span className="user-state-badge approved">승인완료</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <AppModal
          open={modalState.open}
          title={modalState.title}
          message={modalState.message}
          onClose={closeModal}
        />
      </div>
    </div>
  );
}

export default App;