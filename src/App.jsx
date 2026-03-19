import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEYS = {
  demolitionData: "clean-demolition-data-v10",
  requests: "clean-demolition-requests-v10",
  authUsers: "clean-demolition-auth-users-v10",
  authSession: "clean-demolition-auth-session-v10",
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
const PAGE_SIZE = 20;

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

function getStatusLabel(status) {
  switch (status) {
    case "접수":
      return "접수";
    case "검토중":
      return "검토중";
    case "확정":
      return "확정";
    case "완료":
      return "완료";
    case "보류":
      return "보류";
    default:
      return status;
  }
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

function App() {
  const [demolitionData, setDemolitionData] = useState(() =>
    loadLocalStorage(STORAGE_KEYS.demolitionData, createInitialDemolitionData())
  );
  const [users, setUsers] = useState(() =>
    loadLocalStorage(STORAGE_KEYS.authUsers, initialUsers)
  );
  const [requests, setRequests] = useState(() =>
    loadLocalStorage(STORAGE_KEYS.requests, [])
  );
  const [session, setSession] = useState(() =>
    loadLocalStorage(STORAGE_KEYS.authSession, null)
  );

  const [authMode, setAuthMode] = useState("signup");
  const [signupForm, setSignupForm] = useState({
    companyName: "",
    phone: "",
    id: "",
    password: "",
    confirmPassword: "",
  });
  const [loginForm, setLoginForm] = useState({
    id: "",
    password: "",
  });

  const [showServiceHistory, setShowServiceHistory] = useState(false);
  const [settlementDrafts, setSettlementDrafts] = useState({});
  const [showApprovedUsersPopup, setShowApprovedUsersPopup] = useState(false);
  const [approvedSearch, setApprovedSearch] = useState("");

  const [adminTab, setAdminTab] = useState("request");
  const [requestPage, setRequestPage] = useState(1);
  const [progressPage, setProgressPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedSearchInput, setCompletedSearchInput] = useState("");
  const [completedSearchKeyword, setCompletedSearchKeyword] = useState("");

  const categoryList = Object.keys(demolitionData);
  const firstCategory = categoryList[0] || "";
  const firstCategoryOptions = demolitionData[firstCategory] || [];

  const [requestForm, setRequestForm] = useState({
    address: "",
    detailAddress: "",
    requestDate: "",
    category: firstCategory,
    currentItemId: firstCategoryOptions[0]?.id || "",
    currentQuantity: 1,
    detailItems: [],
    memo: "",
  });

  const [adminPriceForm, setAdminPriceForm] = useState({
    category: firstCategory,
    name: "",
    price: "",
    unit: "",
  });

  useEffect(() => {
    saveLocalStorage(STORAGE_KEYS.demolitionData, demolitionData);
  }, [demolitionData]);

  useEffect(() => {
    saveLocalStorage(STORAGE_KEYS.authUsers, users);
  }, [users]);

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
        currentItemId: nextOptions[0]?.id || "",
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
    return users.find((user) => user.id === session.id) || null;
  }, [session, users]);

  const isAdmin = currentUser?.role === "admin";

  const currentCategoryOptions = useMemo(() => {
    return demolitionData[requestForm.category] || [];
  }, [demolitionData, requestForm.category]);

  const requestTotalPrice = useMemo(() => {
    return requestForm.detailItems.reduce((sum, item) => sum + item.total, 0);
  }, [requestForm.detailItems]);

  const activeRequests = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return requests;
    return requests.filter(
      (request) => request.userId === currentUser.id && request.status !== "완료"
    );
  }, [requests, currentUser, isAdmin]);

  const serviceHistory = useMemo(() => {
    if (!currentUser || isAdmin) return [];
    return requests.filter(
      (request) => request.userId === currentUser.id && request.status === "완료"
    );
  }, [requests, currentUser, isAdmin]);

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
      ["접수", "검토중", "보류"].includes(request.status)
    );
  }, [requests]);

  const progressManagementList = useMemo(() => {
    return requests.filter((request) => request.status === "확정");
  }, [requests]);

  const completedManagementList = useMemo(() => {
    const keyword = completedSearchKeyword.trim().toLowerCase();

    return requests
      .filter((request) => request.status === "완료")
      .filter((request) => {
        if (!keyword) return true;
        return request.companyName.toLowerCase().includes(keyword);
      });
  }, [requests, completedSearchKeyword]);

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

  const handleSignup = (event) => {
    event.preventDefault();

    const companyName = signupForm.companyName.trim();
    const phone = signupForm.phone.trim();
    const id = signupForm.id.trim();
    const password = signupForm.password.trim();
    const confirmPassword = signupForm.confirmPassword.trim();

    if (!companyName || !phone || !id || !password || !confirmPassword) {
      alert("모든 항목을 입력해 주세요.");
      return;
    }

    if (password !== confirmPassword) {
      alert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    const exists = users.some((user) => user.id === id);
    if (exists) {
      alert("이미 사용 중인 아이디입니다.");
      return;
    }

    const newUser = {
      id,
      password,
      companyName,
      phone,
      role: "customer",
      approved: false,
      createdAt: new Date().toISOString(),
    };

    setUsers([...users, newUser]);
    setSession({ id: newUser.id });

    setSignupForm({
      companyName: "",
      phone: "",
      id: "",
      password: "",
      confirmPassword: "",
    });

    alert("회원가입이 완료되었습니다.");
  };

  const handleLogin = (event) => {
    event.preventDefault();

    const id = loginForm.id.trim();
    const password = loginForm.password.trim();

    const matchedUser = users.find(
      (user) => user.id === id && user.password === password
    );

    if (!matchedUser) {
      alert("아이디 또는 비밀번호를 확인해 주세요.");
      return;
    }

    setSession({ id: matchedUser.id });
    setLoginForm({ id: "", password: "" });
  };

  const handleLogout = () => {
    setSession(null);
    setShowServiceHistory(false);
  };

  const handleAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert("주소검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: function (data) {
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
      currentItemId: nextOptions[0]?.id || "",
      currentQuantity: 1,
    }));
  };

  const handleAddCurrentItem = () => {
    const quantity = Number(requestForm.currentQuantity || 0);

    if (!requestForm.category) {
      alert("철거 카테고리를 선택해 주세요.");
      return;
    }

    if (!requestForm.currentItemId) {
      alert("세부내용을 선택해 주세요.");
      return;
    }

    if (quantity <= 0) {
      alert("수량은 1 이상이어야 합니다.");
      return;
    }

    const selectedItem = currentCategoryOptions.find(
      (item) => item.id === Number(requestForm.currentItemId)
    );

    if (!selectedItem) {
      alert("선택한 세부 항목을 찾을 수 없습니다.");
      return;
    }

    setRequestForm((prev) => {
      const existingIndex = prev.detailItems.findIndex(
        (item) =>
          item.category === prev.category &&
          item.itemId === Number(prev.currentItemId)
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
          currentQuantity: 1,
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
        currentQuantity: 1,
      };
    });
  };

  const handleRemoveAddedItem = (rowId) => {
    setRequestForm((prev) => ({
      ...prev,
      detailItems: prev.detailItems.filter((item) => item.rowId !== rowId),
    }));
  };

  const handleCreateRequest = (event) => {
    event.preventDefault();

    if (!currentUser) {
      alert("로그인 후 이용해 주세요.");
      return;
    }

    if (!requestForm.address.trim() || !requestForm.requestDate || !requestForm.category) {
      alert("주소, 희망 일정, 카테고리를 입력해 주세요.");
      return;
    }

    if (requestForm.detailItems.length === 0) {
      alert("세부 항목을 1개 이상 추가해 주세요.");
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
      id: Date.now(),
      userId: currentUser.id,
      companyName: currentUser.companyName,
      userPhone: currentUser.phone || "",
      address: fullAddress,
      roadAddress: requestForm.address.trim(),
      detailAddress: requestForm.detailAddress.trim(),
      requestDate: requestForm.requestDate,
      category: requestForm.category,
      detailItems: cloneItems(requestForm.detailItems),
      actualDetailItems: cloneItems(requestForm.detailItems),
      memo: requestForm.memo.trim(),
      totalPrice,
      settledTotalPrice: totalPrice,
      status: "접수",
      approvedUser: currentUser.approved,
      createdAt: new Date().toISOString(),
      pdfReady: false,
      kakaoSent: false,
      settledAt: null,
    };

    setRequests((prev) => [newRequest, ...prev]);

    const resetOptions = demolitionData[firstCategory] || [];
    setRequestForm({
      address: "",
      detailAddress: "",
      requestDate: "",
      category: firstCategory,
      currentItemId: resetOptions[0]?.id || "",
      currentQuantity: 1,
      detailItems: [],
      memo: "",
    });

    alert("일정 요청이 등록되었습니다.");
  };

  const handleApproveUser = (userId) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, approved: true } : user
      )
    );
  };

  const updateRequestStatus = (requestId, status) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId ? { ...request, status } : request
      )
    );
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

    const kakaoResult = await sendKakaoNotification({
      ...targetRequest,
      status: "확정",
    });

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: "확정",
              pdfReady: true,
              kakaoSent: kakaoResult.success,
            }
          : request
      )
    );

    alert(
      kakaoResult.mode === "sdk"
        ? "확정 처리되었습니다.\n카카오 발송이 실행되었고 PDF 출력이 가능합니다."
        : "확정 처리되었습니다.\nPDF 출력이 가능합니다.\n현재는 카카오 자동발송 연동 준비형 상태로 저장됩니다."
    );
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
        currentItemId: baseOptions[0]?.id || "",
        currentQuantity: 1,
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
            currentItemId: nextOptions[0]?.id || "",
            currentQuantity: 1,
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

  const handleAddSettlementItem = (requestId) => {
    const draft = settlementDrafts[requestId];
    if (!draft) return;

    const options = demolitionData[draft.category] || [];
    const selectedItem = options.find(
      (item) => item.id === Number(draft.currentItemId)
    );
    const quantity = Number(draft.currentQuantity || 0);

    if (!selectedItem) {
      alert("정산할 세부 항목을 선택해 주세요.");
      return;
    }

    if (quantity <= 0) {
      alert("수량은 1 이상이어야 합니다.");
      return;
    }

    setSettlementDrafts((prev) => {
      const currentDraft = prev[requestId];
      if (!currentDraft) return prev;

      const existingIndex = currentDraft.actualItems.findIndex(
        (item) =>
          item.category === currentDraft.category &&
          item.itemId === Number(currentDraft.currentItemId)
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
          currentQuantity: 1,
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

  const handleSaveSettlement = (requestId) => {
    const draft = settlementDrafts[requestId];
    if (!draft) return;

    const nextTotal = calculateTotal(draft.actualItems);

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              actualDetailItems: cloneItems(draft.actualItems),
              settledTotalPrice: nextTotal,
            }
          : request
      )
    );

    alert("정산 내역이 저장되었습니다.");
  };

  const handleCompleteRequest = (requestId) => {
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

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              actualDetailItems: finalItems,
              settledTotalPrice: finalTotal,
              status: "완료",
              settledAt: new Date().toISOString(),
            }
          : request
      )
    );

    closeSettlementEditor(requestId);
    alert("공사완료 처리되었습니다.");
  };

  const handlePrintPdf = (request) => {
    if (!request.pdfReady) {
      alert("확정 후 PDF 출력이 가능합니다.");
      return;
    }

    const pdfItems =
      request.status === "완료" && request.actualDetailItems?.length
        ? request.actualDetailItems
        : request.detailItems;

    const pdfTotal =
      request.status === "완료"
        ? request.settledTotalPrice || request.totalPrice
        : request.totalPrice;

    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.");
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
            .total { margin-top: 24px; font-size: 24px; font-weight: 700; text-align: right; }
            .status { display: inline-block; padding: 6px 10px; border-radius: 999px; background:#dcfce7; color:#166534; font-weight:700; }
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
            <strong>${request.status === "완료" ? "정산 항목" : "확정 항목"}</strong>
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

          <div class="total">합계금액 ${formatNumber(pdfTotal)}원</div>

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

  const handleAddPriceItem = (event) => {
    event.preventDefault();

    const category = adminPriceForm.category;
    const name = adminPriceForm.name.trim();
    const price = Number(adminPriceForm.price);
    const unit = adminPriceForm.unit.trim();

    if (!category || !name || !price || !unit) {
      alert("카테고리, 항목명, 단가, 단위를 모두 입력해 주세요.");
      return;
    }

    const newItem = {
      id: Date.now(),
      name,
      price,
      unit,
    };

    setDemolitionData((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), newItem],
    }));

    setAdminPriceForm((prev) => ({
      ...prev,
      name: "",
      price: "",
      unit: "",
    }));
  };

  const handleDeletePriceItem = (category, itemId) => {
    setDemolitionData((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((item) => item.id !== itemId),
    }));
  };

  const handleSearchCompleted = () => {
    setCompletedPage(1);
    setCompletedSearchKeyword(completedSearchInput.trim());
  };

  return (
    <div className="app">
      <div className="container">
        <header className="page-header">
          <div>
            <p className="eyebrow">CLEAN DEMOLITION</p>
            <h1>클린철거 일정요청 웹앱</h1>
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
                  <button className="secondary-btn" onClick={handleLogout}>
                    로그아웃
                  </button>
                  {!isAdmin && (
                    <button
                      className="secondary-btn small-btn"
                      onClick={() => setShowServiceHistory((prev) => !prev)}
                    >
                      서비스내역조회
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="secondary-btn small-btn"
                      onClick={() => setShowApprovedUsersPopup(true)}
                    >
                      승인완료회원
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  className={authMode === "login" ? "primary-btn" : "secondary-btn"}
                  onClick={() => setAuthMode("login")}
                >
                  로그인
                </button>
                <button
                  className={authMode === "signup" ? "primary-btn" : "secondary-btn"}
                  onClick={() => setAuthMode("signup")}
                >
                  회원가입
                </button>
              </>
            )}
          </div>
        </header>

        {!currentUser && (
          <section className="auth-grid">
            <div className="section-card auth-card">
              <h2>{authMode === "signup" ? "회원가입" : "로그인"}</h2>
              <p className="section-description">
                고객은 견적과 일정 요청을 진행하고, 관리자는 회원/단가/일정을 운영합니다.
              </p>

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
                      value={signupForm.phone}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
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

                  <button type="submit" className="primary-btn full-width">
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

                  <button type="submit" className="primary-btn full-width">
                    로그인하기
                  </button>
                </form>
              )}
            </div>

            <div className="section-card info-card">
              <h2>이용 안내</h2>
              <div className="info-list">
                <div className="info-item">
                  <strong>1. 회원가입</strong>
                  <span>회원가입 후 로그인하여 바로 일정 요청 가능</span>
                </div>
                <div className="info-item">
                  <strong>2. 일정 요청</strong>
                  <span>철거 항목과 수량, 희망 날짜, 주소 입력</span>
                </div>
                <div className="info-item">
                  <strong>3. 관리자 검토</strong>
                  <span>접수 후 회원 승인 및 일정 확정 처리</span>
                </div>
                <div className="info-item">
                  <strong>4. 상태 확인</strong>
                  <span>접수 / 검토중 / 확정 / 완료 상태 확인 가능</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {currentUser && !isAdmin && (
          <div className="dashboard-grid">
            <section className="section-card">
              {!currentUser.approved && (
                <div className="notice-box">
                  관리자 승인 후 일정확정이 진행됩니다.
                </div>
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
                      onChange={(e) =>
                        setRequestForm((prev) => ({
                          ...prev,
                          currentItemId: Number(e.target.value),
                        }))
                      }
                    >
                      {currentCategoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} / {formatNumber(option.price)}원 / {option.unit}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={requestForm.currentQuantity}
                      onChange={(e) =>
                        setRequestForm((prev) => ({
                          ...prev,
                          currentQuantity: Number(e.target.value),
                        }))
                      }
                      placeholder="수량"
                    />

                    <button
                      type="button"
                      className="primary-btn small-btn"
                      onClick={handleAddCurrentItem}
                    >
                      추가
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

            <section className="section-card">
              <div className="card-header">
                <div>
                  <h2>{showServiceHistory ? "서비스내역조회" : "내 요청 내역"}</h2>
                  <p className="section-description">
                    {showServiceHistory
                      ? "완료된 지난 거래내역을 확인할 수 있습니다."
                      : "요청한 일정과 진행 상태를 확인할 수 있습니다."}
                  </p>
                </div>
              </div>

              {!showServiceHistory ? (
                activeRequests.length === 0 ? (
                  <div className="empty-box">등록된 요청이 없습니다.</div>
                ) : (
                  <div className="request-list">
                    {activeRequests.map((request) => (
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

                        <div className="request-items">
                          {request.detailItems.map((item, index) => (
                            <div key={`${request.id}-${index}`} className="request-item">
                              <span>
                                [{item.category}] {item.name} / {item.quantity}
                                {item.unit}
                              </span>
                              <strong>{formatNumber(item.total)}원</strong>
                            </div>
                          ))}
                        </div>

                        {request.memo && (
                          <div className="request-memo">요청사항: {request.memo}</div>
                        )}

                        <div className="request-summary-box">
                          <div className="request-summary-item">
                            <span>희망일정</span>
                            <strong>{formatDate(request.requestDate)}</strong>
                          </div>
                          <div className="request-summary-item total">
                            <span>합계금액</span>
                            <strong>{formatNumber(request.totalPrice)}원</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : serviceHistory.length === 0 ? (
                <div className="empty-box">완료된 서비스 내역이 없습니다.</div>
              ) : (
                <div className="request-list">
                  {serviceHistory.map((request) => (
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

                      <div className="request-items">
                        {(request.actualDetailItems?.length
                          ? request.actualDetailItems
                          : request.detailItems
                        ).map((item, index) => (
                          <div key={`${request.id}-${index}`} className="request-item">
                            <span>
                              [{item.category}] {item.name} / {item.quantity}
                              {item.unit}
                            </span>
                            <strong>{formatNumber(item.total)}원</strong>
                          </div>
                        ))}
                      </div>

                      {request.memo && (
                        <div className="request-memo">요청사항: {request.memo}</div>
                      )}

                      <div className="request-summary-box">
                        <div className="request-summary-item">
                          <span>작업일정</span>
                          <strong>{formatDate(request.requestDate)}</strong>
                        </div>
                        <div className="request-summary-item total">
                          <span>정산금액</span>
                          <strong>
                            {formatNumber(
                              request.settledTotalPrice || request.totalPrice
                            )}
                            원
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <div className="empty-box">신규 승인 요청 회원이 없습니다.</div>
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
                        onClick={() => handleApproveUser(user.id)}
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
              </div>

              {adminTab === "request" && (
                <>
                  <div className="card-header">
                    <div>
                      <h2>일정요청관리</h2>
                      <p className="section-description">
                        접수 / 검토중 / 보류 상태의 요청을 관리합니다.
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

                          <div className="request-items">
                            {request.detailItems.map((item, index) => (
                              <div key={`${request.id}-${index}`} className="request-item">
                                <span>
                                  [{item.category}] {item.name} / {item.quantity}
                                  {item.unit}
                                </span>
                                <strong>{formatNumber(item.total)}원</strong>
                              </div>
                            ))}
                          </div>

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
                              onClick={() => updateRequestStatus(request.id, "보류")}
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
                        확정된 건에 대해 정산 내용을 수정하고 공사완료 처리합니다.
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

                            <div className="request-items">
                              {(request.actualDetailItems?.length
                                ? request.actualDetailItems
                                : request.detailItems
                              ).map((item, index) => (
                                <div key={`${request.id}-${index}`} className="request-item">
                                  <span>
                                    [{item.category}] {item.name} / {item.quantity}
                                    {item.unit}
                                  </span>
                                  <strong>{formatNumber(item.total)}원</strong>
                                </div>
                              ))}
                            </div>

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
                                <strong>
                                  {formatNumber(
                                    request.settledTotalPrice || request.totalPrice
                                  )}
                                  원
                                </strong>
                              </div>
                            </div>

                            <div className="status-actions">
                              <button
                                className="secondary-btn small-btn"
                                onClick={() => openSettlementEditor(request)}
                              >
                                정산하기
                              </button>
                              <button
                                className="primary-btn small-btn"
                                onClick={() => handleCompleteRequest(request.id)}
                              >
                                공사완료
                              </button>
                              <button
                                className="secondary-btn small-btn"
                                disabled={!request.pdfReady}
                                onClick={() => handlePrintPdf(request)}
                              >
                                PDF 출력
                              </button>
                            </div>

                            {settlementDraft && (
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
                                        Number(e.target.value)
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

                                  <input
                                    type="number"
                                    min="1"
                                    value={settlementDraft.currentQuantity}
                                    onChange={(e) =>
                                      updateSettlementDraftField(
                                        request.id,
                                        "currentQuantity",
                                        Number(e.target.value)
                                      )
                                    }
                                    placeholder="수량"
                                  />

                                  <button
                                    type="button"
                                    className="primary-btn small-btn"
                                    onClick={() => handleAddSettlementItem(request.id)}
                                  >
                                    추가
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
                                    <button
                                      type="button"
                                      className="primary-btn small-btn"
                                      onClick={() => handleCompleteRequest(request.id)}
                                    >
                                      공사완료
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
                        완료된 공사를 업체별로 검색하고 확인할 수 있습니다.
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
                    <div className="request-list">
                      {completedPagination.items.map((request) => (
                        <div className="request-card" key={request.id}>
                          <div className="request-top">
                            <div>
                              <h3>{request.companyName}</h3>
                              <p>{request.address}</p>
                            </div>
                            <span className="status-badge 완료">완료</span>
                          </div>

                          <div className="request-items">
                            {(request.actualDetailItems?.length
                              ? request.actualDetailItems
                              : request.detailItems
                            ).map((item, index) => (
                              <div key={`${request.id}-${index}`} className="request-item">
                                <span>
                                  [{item.category}] {item.name} / {item.quantity}
                                  {item.unit}
                                </span>
                                <strong>{formatNumber(item.total)}원</strong>
                              </div>
                            ))}
                          </div>

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
                              <strong>
                                {formatNumber(
                                  request.settledTotalPrice || request.totalPrice
                                )}
                                원
                              </strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Pagination
                    page={completedPagination.currentPage}
                    totalPages={completedPagination.totalPages}
                    onChange={setCompletedPage}
                  />
                </>
              )}
            </section>

            <section className="section-card">
              <div className="card-header">
                <div>
                  <h2>단가표 관리</h2>
                  <p className="section-description">
                    카테고리별 철거 단가를 추가하거나 삭제할 수 있습니다.
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
                  placeholder="항목명"
                  value={adminPriceForm.name}
                  onChange={(e) =>
                    setAdminPriceForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />

                <input
                  type="number"
                  placeholder="단가"
                  value={adminPriceForm.price}
                  onChange={(e) =>
                    setAdminPriceForm((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                />

                <input
                  type="text"
                  placeholder="단위"
                  value={adminPriceForm.unit}
                  onChange={(e) =>
                    setAdminPriceForm((prev) => ({
                      ...prev,
                      unit: e.target.value,
                    }))
                  }
                />

                <button type="submit" className="primary-btn">
                  항목 추가
                </button>
              </form>

              <div className="price-board">
                {categoryList.map((category) => (
                  <div className="sub-card" key={category}>
                    <h3>{category}</h3>
                    <div className="price-list">
                      {(demolitionData[category] || []).map((item) => (
                        <div className="price-item" key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <p>
                              {formatNumber(item.price)}원 / {item.unit}
                            </p>
                          </div>
                          <button
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

        {showApprovedUsersPopup && (
          <div className="popup-overlay" onClick={() => setShowApprovedUsersPopup(false)}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <h3>승인완료회원</h3>
                <button
                  className="secondary-btn small-btn"
                  onClick={() => setShowApprovedUsersPopup(false)}
                >
                  닫기
                </button>
              </div>

              <div className="input-group">
                <label>회원 검색</label>
                <input
                  type="text"
                  value={approvedSearch}
                  onChange={(e) => setApprovedSearch(e.target.value)}
                  placeholder="아이디 / 회사명 / 휴대전화 검색"
                />
              </div>

              {approvedUsers.length === 0 ? (
                <div className="empty-box">검색 결과가 없습니다.</div>
              ) : (
                <div className="simple-list popup-list">
                  {approvedUsers.map((user) => (
                    <div key={user.id} className="simple-item">
                      <div>
                        <strong>{user.id}</strong>
                        <p>
                          {user.companyName}
                          {user.phone ? ` / ${user.phone}` : ""}
                        </p>
                      </div>
                      <span className="status-badge approved">승인완료</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;