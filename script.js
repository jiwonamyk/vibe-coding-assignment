/**
 * ==========================================================================
 * TICKET IDOL - CORE JAVASCRIPT CONTROLLER
 * ==========================================================================
 */

// 1. 가상 콘서트 데이터 정의
const CONCERT_DATA = {
  aespa: {
    id: "aespa",
    name: "aespa LIVE TOUR - SYNK: PARALLEL LINE",
    dates: ["2026.07.18 (토)", "2026.07.19 (일)"],
    times: ["14:00 (1회차)", "19:00 (2회차)"],
    venue: "KSPO DOME (올림픽체조경기장)",
    poster: "assets/poster_aespa.png",
    fanclub: "MY"
  },
  nct: {
    id: "nct",
    name: "NCT DREAM WORLD TOUR <THE DREAM SHOW 3>",
    dates: ["2026.08.01 (토)", "2026.08.02 (일)", "2026.08.03 (월)"],
    times: ["15:00 (1회차)", "20:00 (2회차)"],
    venue: "고척스카이돔",
    poster: "assets/poster_nct.png",
    fanclub: "NCTzen DREAM"
  },
  ive: {
    id: "ive",
    name: "IVE WORLD TOUR <COSMIC ECHOES>",
    dates: ["2026.08.15 (토)", "2026.08.16 (일)"],
    times: ["14:00 (1회차)", "18:00 (2회차)"],
    venue: "KSPO DOME (올림픽체조경기장)",
    poster: "assets/poster_ive.png",
    fanclub: "DIVE"
  }
};

// 좌석 등급별 요금 정의
const SEAT_PRICES = {
  VIP: 154000,
  R: 132000,
  S: 110000
};

// 2. 어플리케이션 상태 전역 관리 객체
const state = {
  currentUser: null,           // 현재 로그인한 사용자 객체
  users: [],                   // 가입된 전체 사용자 목록
  selectedConcert: null,       // 현재 선택 중인 공연 ID
  selectedDate: null,          // 현재 선택한 날짜
  selectedTime: null,          // 현재 선택한 시간
  selectedSeats: [],           // 사용자가 현재 예매 과정에서 임시 선택한 좌석 목록
};

// ==========================================================================
// [초기화 로직 및 이벤트 리스너 바인딩]
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initStorage();               // 1. localStorage 정보 동기화
  initRouter();                // 2. SPA 라우팅 초기화
  initAuthUI();                // 3. 로그인 상태에 맞는 UI 렌더링
  bindDOMEvents();             // 4. 일반 버튼 및 폼 전송 이벤트 바인딩
});

// localStorage 기본 데이터 동기화
function initStorage() {
  const storedUsers = localStorage.getItem("ticket_idol_users");
  state.users = storedUsers ? JSON.parse(storedUsers) : [];

  const storedSession = localStorage.getItem("ticket_idol_session");
  state.currentUser = storedSession ? JSON.parse(storedSession) : null;
}

// ==========================================================================
// [SPA 라우팅 시스템]
// ==========================================================================
function initRouter() {
  // 해시 체인지 감지 및 초기 실행
  window.addEventListener("hashchange", handleRouting);
  handleRouting();
}

function handleRouting() {
  const hash = window.location.hash || "#home";
  
  // 인증이 필요한 해시 목록 정의
  const authRequiredHashes = ["#membership", "#booking", "#mypage"];
  
  // 로그인 검증 및 리다이렉트
  if (authRequiredHashes.includes(hash) && !state.currentUser) {
    window.location.hash = "#home";
    showToast("로그인이 필요한 서비스입니다.", "error");
    openAuthModal();
    return;
  }

  // 선예매 참여 페이지는 추가적으로 멤버십 인증 상태 검사
  if (hash === "#booking") {
    // 1. 공연 선택이 선행되었는지 검증
    if (!state.selectedConcert) {
      window.location.hash = "#home";
      showToast("예매할 공연을 먼저 선택해 주세요.", "info");
      return;
    }
    // 2. 해당 공연에 대한 멤버십 인증이 완료되었는지 확인
    const concert = CONCERT_DATA[state.selectedConcert];
    const hasMembership = state.currentUser.memberships && state.currentUser.memberships[state.selectedConcert];
    if (!hasMembership) {
      window.location.hash = "#membership";
      showToast(`${concert.fanclub} 멤버십 인증이 완료되어야 선예매에 참여할 수 있습니다.`, "error");
      
      // 멤버십 아티스트 자동 지정
      const selectGroup = document.getElementById("member-group");
      selectGroup.value = state.selectedConcert;
      return;
    }
  }

  // 활성 섹션 전환
  document.querySelectorAll(".spa-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));

  if (hash === "#home") {
    document.getElementById("home-section").classList.add("active");
    document.getElementById("nav-home-btn").classList.add("active");
  } else if (hash === "#membership") {
    document.getElementById("membership-section").classList.add("active");
    // 기수/번호 등 입력 폼 상태 초기화
    document.getElementById("membership-form").reset();
  } else if (hash === "#booking") {
    document.getElementById("booking-section").classList.add("active");
    setupBookingWizard(); // 예매 단계 셋업
  } else if (hash === "#mypage") {
    document.getElementById("mypage-section").classList.add("active");
    document.getElementById("nav-mypage-btn").classList.add("active");
    renderMypage(); // 마이페이지 정보 최신화
  }

  // 페이지 이동 시 상단 스크롤
  window.scrollTo(0, 0);
}

// ==========================================================================
// [인터랙티브 UI 및 이벤트 핸들링]
// ==========================================================================
function bindDOMEvents() {
  // 네비게이션 로고 클릭 시 강제 리로드 또는 리다이렉트
  document.getElementById("nav-logo-link").addEventListener("click", (e) => {
    state.selectedConcert = null; // 공연 선택 리셋
  });

  // 로그인/회원가입 모달 열기
  document.getElementById("open-login-btn").addEventListener("click", openAuthModal);
  
  // 로그인/회원가입 모달 닫기
  document.getElementById("close-auth-modal-btn").addEventListener("click", closeAuthModal);
  
  // 모달 외부 클릭 시 닫기
  document.getElementById("auth-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("auth-modal")) closeAuthModal();
  });

  // 모달 탭 전환
  document.getElementById("tab-login-btn").addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tab-register-btn").addEventListener("click", () => switchAuthTab("register"));

  // 로그인 폼 전송
  document.getElementById("login-form").addEventListener("submit", handleLoginSubmit);

  // 회원가입 폼 전송
  document.getElementById("register-form").addEventListener("submit", handleRegisterSubmit);

  // 공연 카드 예매하기 버튼 이벤트 위임
  document.getElementById("concert-list").addEventListener("click", (e) => {
    if (e.target.classList.contains("book-now-btn")) {
      const concertId = e.target.getAttribute("data-id");
      startPresaleProcess(concertId);
    }
  });

  // 멤버십 인증 폼 전송
  document.getElementById("membership-form").addEventListener("submit", handleMembershipSubmit);
  document.getElementById("cancel-membership-btn").addEventListener("click", () => {
    window.location.hash = "#home";
  });

  // 예매 프로세스: 날짜 선택 후 다음 단계 이동
  document.getElementById("go-to-seats-btn").addEventListener("click", proceedToSeatsStep);
  document.getElementById("back-to-dates-btn").addEventListener("click", backToDatesStep);

  // 예매 최종 완료하기 버튼
  document.getElementById("complete-booking-btn").addEventListener("click", processFinalBooking);

  // 예매 성공 모달 확인/닫기 버튼 -> 마이페이지로 이동
  document.getElementById("close-success-modal-btn").addEventListener("click", () => {
    document.getElementById("success-modal").classList.remove("active");
    window.location.hash = "#mypage";
  });

  // 전체 데이터 초기화 버튼
  document.getElementById("reset-app-data-btn").addEventListener("click", resetAllData);
}

// ==========================================================================
// [회원 관리 시스템 (Auth)]
// ==========================================================================
function initAuthUI() {
  const container = document.getElementById("auth-status-container");
  
  if (state.currentUser) {
    // 로그인 완료된 상태
    container.innerHTML = `
      <div class="nav-auth-user">
        <span class="user-welcome">👋 <strong>${state.currentUser.name}</strong>님 환영합니다</span>
        <button class="btn btn-outline" id="logout-btn">로그아웃</button>
      </div>
    `;
    
    // 로그아웃 리스너 동적 연결
    document.getElementById("logout-btn").addEventListener("click", handleLogout);
  } else {
    // 비로그인 상태
    container.innerHTML = `
      <button class="btn btn-outline" id="open-login-btn">로그인 / 회원가입</button>
    `;
    document.getElementById("open-login-btn").addEventListener("click", openAuthModal);
  }
}

function openAuthModal() {
  document.getElementById("auth-modal").classList.add("active");
  switchAuthTab("login");
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("active");
  document.getElementById("login-form").reset();
  document.getElementById("register-form").reset();
}

function switchAuthTab(tab) {
  const loginBtn = document.getElementById("tab-login-btn");
  const regBtn = document.getElementById("tab-register-btn");
  const loginForm = document.getElementById("login-form-container");
  const regForm = document.getElementById("register-form-container");

  if (tab === "login") {
    loginBtn.classList.add("active");
    regBtn.classList.remove("active");
    loginForm.classList.add("active");
    regForm.classList.remove("active");
  } else {
    loginBtn.classList.remove("active");
    regBtn.classList.add("active");
    loginForm.classList.remove("active");
    regForm.classList.add("active");
  }
}

// 회원가입 전송 핸들러
function handleRegisterSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById("register-id").value.trim();
  const pwInput = document.getElementById("register-pw").value;
  const nameInput = document.getElementById("register-name").value.trim();
  const emailInput = document.getElementById("register-email").value.trim();

  // 아이디 중복 체크
  if (state.users.some(user => user.id === idInput)) {
    showToast("이미 사용 중인 아이디입니다.", "error");
    return;
  }

  // 신규 가입자 모델 빌드
  const newUser = {
    id: idInput,
    password: pwInput,
    name: nameInput,
    email: emailInput,
    memberships: {}, // 아티스트 아이디를 키로 팬클럽 정보 저장
    myTickets: []    // 예매한 가상 티켓 목록
  };

  // 상태 및 LocalStorage 저장
  state.users.push(newUser);
  localStorage.setItem("ticket_idol_users", JSON.stringify(state.users));

  showToast("회원가입이 완료되었습니다! 로그인해 주세요.", "success");
  switchAuthTab("login");
  document.getElementById("register-form").reset();
}

// 로그인 전송 핸들러
function handleLoginSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById("login-id").value.trim();
  const pwInput = document.getElementById("login-pw").value;

  const targetUser = state.users.find(user => user.id === idInput && user.password === pwInput);

  if (!targetUser) {
    showToast("아이디 또는 비밀번호가 일치하지 않습니다.", "error");
    return;
  }

  // 로그인 상태 동기화
  state.currentUser = targetUser;
  localStorage.setItem("ticket_idol_session", JSON.stringify(state.currentUser));

  showToast(`${targetUser.name}님, 환영합니다!`, "success");
  closeAuthModal();
  initAuthUI();
  
  // 마이페이지에 있는 경우 상태 갱신
  if (window.location.hash === "#mypage") {
    renderMypage();
  }
}

// 로그아웃 핸들러
function handleLogout() {
  state.currentUser = null;
  state.selectedConcert = null;
  localStorage.removeItem("ticket_idol_session");
  
  showToast("로그아웃되었습니다.", "info");
  initAuthUI();
  window.location.hash = "#home";
}

// ==========================================================================
// [팬클럽 멤버십 인증 시스템]
// ==========================================================================
function startPresaleProcess(concertId) {
  state.selectedConcert = concertId;
  
  // 1. 로그인 여부 확인
  if (!state.currentUser) {
    showToast("선예매를 하려면 로그인이 필요합니다.", "info");
    openAuthModal();
    return;
  }

  // 2. 멤버십 인증 여부 확인
  const hasVerified = state.currentUser.memberships && state.currentUser.memberships[concertId];
  if (hasVerified) {
    window.location.hash = "#booking";
  } else {
    // 미인증 유저 -> 인증 화면 유도
    window.location.hash = "#membership";
    showToast("선예매 자격 확인을 위해 팬클럽 멤버십 인증을 먼저 진행해 주세요.", "info");
    
    // 타겟 그룹 드롭다운 즉시 반영
    setTimeout(() => {
      document.getElementById("member-group").value = concertId;
    }, 100);
  }
}

// 멤버십 인증 전송 핸들러
function handleMembershipSubmit(e) {
  e.preventDefault();
  
  const selectedGroup = document.getElementById("member-group").value;
  const generation = document.getElementById("member-generation").value;
  const memberNum = document.getElementById("member-number").value.trim();
  const realName = document.getElementById("member-name").value.trim();
  const birthNum = document.getElementById("member-birth").value.trim();

  // 1. 멤버십 번호 정규식 체크 (IDOL-8자리 숫자)
  const memberNumRegex = /^IDOL-\d{8}$/;
  if (!memberNumRegex.test(memberNum)) {
    showToast("멤버십 번호 형식이 잘못되었습니다. (예: IDOL-12345678)", "error");
    return;
  }

  // 2. 생년월일 형식 체크 (8자리 숫자)
  const birthRegex = /^\d{8}$/;
  if (!birthRegex.test(birthNum)) {
    showToast("생년월일은 8자리 숫자로 입력해야 합니다. (예: 20000101)", "error");
    return;
  }

  // 가상의 성공 연출
  const concert = CONCERT_DATA[selectedGroup];
  
  // 세션 정보 업데이트
  if (!state.currentUser.memberships) {
    state.currentUser.memberships = {};
  }
  
  state.currentUser.memberships[selectedGroup] = {
    groupName: concert.name,
    fanclubName: concert.fanclub,
    generation: generation,
    number: memberNum,
    name: realName,
    birth: birthNum,
    verifiedAt: new Date().toLocaleDateString()
  };

  // DB 동기화
  updateUserSession();

  showToast(`${concert.fanclub} 멤버십 선예매 인증이 완료되었습니다!`, "success");
  
  // 성공 후 예매 진행 중이었다면 해당 예매화면으로, 아니라면 홈으로 이동
  state.selectedConcert = selectedGroup;
  window.location.hash = "#booking";
}

// 유저 세션 및 전체 DB 동기화 Helper
function updateUserSession() {
  localStorage.setItem("ticket_idol_session", JSON.stringify(state.currentUser));

  // 전체 유저 DB에도 업데이트 반영
  state.users = state.users.map(u => u.id === state.currentUser.id ? state.currentUser : u);
  localStorage.setItem("ticket_idol_users", JSON.stringify(state.users));
}

// ==========================================================================
// [예매 흐름 제어 (Booking Process)]
// ==========================================================================
function setupBookingWizard() {
  const concert = CONCERT_DATA[state.selectedConcert];
  
  // 단계 1 상태 초기화
  state.selectedDate = null;
  state.selectedTime = null;
  state.selectedSeats = [];

  // 공연 정보 간략 렌더링
  document.getElementById("booking-concert-info").innerHTML = `
    <div class="mini-info-header">${concert.fanclub} 선예매</div>
    <div class="mini-info-title">${concert.name}</div>
    <div class="mini-info-meta">
      <span><i class="fa-solid fa-location-dot"></i> ${concert.venue}</span>
    </div>
  `;

  // UI 활성화 단계 강제 1단계 전환
  backToDatesStep();

  // 날짜 피커 렌더링
  const dateContainer = document.getElementById("date-select-container");
  dateContainer.innerHTML = "";
  concert.dates.forEach(date => {
    const btn = document.createElement("div");
    btn.className = "picker-item";
    btn.innerHTML = `
      <strong>${date.split(" ")[0]}</strong>
      <span>${date.split(" ")[1] || ""}</span>
    `;
    btn.addEventListener("click", () => selectBookingDate(date, btn));
    dateContainer.appendChild(btn);
  });

  // 회차 컨테이너 기본 대기 메시지
  document.getElementById("time-select-container").innerHTML = `
    <p class="helper-text">날짜를 먼저 선택해 주세요.</p>
  `;
}

function selectBookingDate(date, element) {
  state.selectedDate = date;
  state.selectedTime = null; // 날짜가 바뀌면 회차 리셋
  document.getElementById("go-to-seats-btn").disabled = true;

  // 액티브 스타일 이동
  document.querySelectorAll("#date-select-container .picker-item").forEach(item => item.classList.remove("selected"));
  element.classList.add("selected");

  // 회차(시간) 피커 로딩
  const concert = CONCERT_DATA[state.selectedConcert];
  const timeContainer = document.getElementById("time-select-container");
  timeContainer.innerHTML = "";
  
  concert.times.forEach(time => {
    const btn = document.createElement("div");
    btn.className = "picker-item";
    btn.innerHTML = `
      <strong>${time.split(" ")[0]}</strong>
      <span>${time.split(" ")[1] || ""}</span>
    `;
    btn.addEventListener("click", () => selectBookingTime(time, btn));
    timeContainer.appendChild(btn);
  });
}

function selectBookingTime(time, element) {
  state.selectedTime = time;
  
  // 액티브 스타일 이동
  document.querySelectorAll("#time-select-container .picker-item").forEach(item => item.classList.remove("selected"));
  element.classList.add("selected");

  // 좌석 선택으로 진입하는 버튼 활성화
  document.getElementById("go-to-seats-btn").disabled = false;
}

// Step 2: 좌석선택 화면 진입
function proceedToSeatsStep() {
  // 인디케이터 교체
  document.getElementById("step-indicator-1").classList.remove("active");
  document.getElementById("step-indicator-2").classList.add("active");

  // 패널 내용 전환
  document.getElementById("booking-step-1-content").classList.remove("active");
  document.getElementById("booking-step-2-content").classList.add("active");

  // 우측 좌석 맵 보드 활성화
  document.getElementById("seats-placeholder").classList.remove("active");

  // 선택된 상태 요약 초기화
  state.selectedSeats = [];
  updateSelectedSeatsSummary();

  // 좌석 맵 동적 생성
  generateSeatMap();
}

// Step 1 복귀
function backToDatesStep() {
  document.getElementById("step-indicator-1").classList.add("active");
  document.getElementById("step-indicator-2").classList.remove("active");

  document.getElementById("booking-step-1-content").classList.add("active");
  document.getElementById("booking-step-2-content").classList.remove("active");

  // 우측 좌석 맵 가림막 치기
  document.getElementById("seats-placeholder").classList.add("active");
}

// ==========================================================================
// [실시간 좌석 배치도 시스템]
// ==========================================================================
function generateSeatMap() {
  const gridContainer = document.getElementById("seat-grid-container");
  gridContainer.innerHTML = "";

  // 10행 x 12열 (A~J행, 1~12열) = 총 120석
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const cols = 12;

  // Grid style 동적 주입
  gridContainer.style.gridTemplateColumns = `repeat(${cols}, 24px)`;

  // 해당 공연/일시의 이미 예약 완료된 좌석 로드 (localStorage 연동)
  const bookingKey = `ticket_idol_bookings_${state.selectedConcert}_${state.selectedDate}_${state.selectedTime}`;
  let bookedSeats = localStorage.getItem(bookingKey);

  if (!bookedSeats) {
    // 데이터가 없는 최초 상황: 테스트를 위해 가상의 예매 완료 좌석 30%를 랜덤 생성
    const randomBooked = [];
    rows.forEach(r => {
      for (let c = 1; c <= cols; c++) {
        // 통상 30% 확률로 품절
        if (Math.random() < 0.3) {
          randomBooked.push(`${r}-${c}`);
        }
      }
    });
    localStorage.setItem(bookingKey, JSON.stringify(randomBooked));
    bookedSeats = randomBooked;
  } else {
    bookedSeats = JSON.parse(bookedSeats);
  }

  // 좌석 엘리먼트 배치
  rows.forEach(row => {
    // 좌석 등급 구분
    let grade = "S"; // 기본 S
    if (['A', 'B', 'C'].includes(row)) grade = "VIP";
    else if (['D', 'E', 'F', 'G'].includes(row)) grade = "R";

    const price = SEAT_PRICES[grade];

    for (let col = 1; col <= cols; col++) {
      const seatId = `${row}-${col}`;
      const seatDiv = document.createElement("div");
      
      // 클래스 빌드
      seatDiv.className = `seat ${grade.toLowerCase()}-seat`;
      if (grade === "VIP") seatDiv.classList.add("vip");
      
      seatDiv.setAttribute("data-seat-id", seatId);
      seatDiv.setAttribute("data-grade", grade);
      seatDiv.setAttribute("data-price", price);
      seatDiv.setAttribute("data-tooltip", `${grade}석 ${row}열 ${col}번 - ${price.toLocaleString()}원`);

      // 품절 확인
      if (bookedSeats.includes(seatId)) {
        seatDiv.classList.add("soldout");
      } else {
        // 예약 가능할 때만 클릭 바인딩
        seatDiv.addEventListener("click", () => toggleSeatSelection(seatDiv, seatId, grade, price));
      }

      gridContainer.appendChild(seatDiv);
    }
  });
}

function toggleSeatSelection(element, seatId, grade, price) {
  if (element.classList.contains("soldout")) return;

  const seatIndex = state.selectedSeats.findIndex(s => s.id === seatId);

  if (seatIndex > -1) {
    // 해제
    state.selectedSeats.splice(seatIndex, 1);
    element.classList.remove("selected");
  } else {
    // 1인 최대 4매 제한
    if (state.selectedSeats.length >= 4) {
      showToast("티켓은 1인 최대 4매까지만 선택할 수 있습니다.", "error");
      return;
    }
    
    // 추가
    state.selectedSeats.push({ id: seatId, grade, price });
    element.classList.add("selected");
  }

  updateSelectedSeatsSummary();
}

function updateSelectedSeatsSummary() {
  const seatsListContainer = document.getElementById("selected-seats-list");
  const countEl = document.getElementById("selected-seats-count");
  const priceEl = document.getElementById("selected-seats-price");
  const payBtn = document.getElementById("complete-booking-btn");

  if (state.selectedSeats.length === 0) {
    seatsListContainer.innerHTML = `<span class="no-selection-text">선택된 좌석이 없습니다.</span>`;
    countEl.textContent = "0석";
    priceEl.textContent = "0원";
    payBtn.disabled = true;
    return;
  }

  // 칩 렌더링
  seatsListContainer.innerHTML = "";
  let totalPrice = 0;

  state.selectedSeats.forEach(seat => {
    totalPrice += seat.price;
    const chip = document.createElement("span");
    chip.className = "seat-chip";
    chip.innerHTML = `
      ${seat.grade} ${seat.id}
      <i class="fa-solid fa-xmark seat-chip-remove" data-id="${seat.id}"></i>
    `;
    
    // x 단추 클릭 시 해제 연동
    chip.querySelector(".seat-chip-remove").addEventListener("click", (e) => {
      const targetId = e.target.getAttribute("data-id");
      const seatEl = document.querySelector(`.seat[data-seat-id="${targetId}"]`);
      if (seatEl) {
        // 기존 엘리먼트 클릭을 강제 트리거하여 해제
        seatEl.click();
      }
    });

    seatsListContainer.appendChild(chip);
  });

  countEl.textContent = `${state.selectedSeats.length}석`;
  priceEl.textContent = `${totalPrice.toLocaleString()}원`;
  payBtn.disabled = false;
}

// ==========================================================================
// [최종 예매 승인 & 결제 로직]
// ==========================================================================
function processFinalBooking() {
  if (state.selectedSeats.length === 0) return;

  const concert = CONCERT_DATA[state.selectedConcert];
  const bookingKey = `ticket_idol_bookings_${state.selectedConcert}_${state.selectedDate}_${state.selectedTime}`;
  
  // 1. 서버 점검 성격으로 타겟 리스트 재검증 (충돌 방지용)
  let currentBooked = JSON.parse(localStorage.getItem(bookingKey) || "[]");
  
  // 충돌 확인
  const isConflict = state.selectedSeats.some(s => currentBooked.includes(s.id));
  if (isConflict) {
    showToast("예매가 진행되는 사이에 이미 선점된 좌석이 있습니다. 다시 선택해 주세요.", "error");
    generateSeatMap(); // 갱신
    return;
  }

  // 2. 예약 데이터에 좌석 확정 추가 및 저장
  state.selectedSeats.forEach(s => currentBooked.push(s.id));
  localStorage.setItem(bookingKey, JSON.stringify(currentBooked));

  // 3. 사용자 영수증 티켓 빌드
  const totalAmount = state.selectedSeats.reduce((acc, cur) => acc + cur.price, 0);
  const seatStrings = state.selectedSeats.map(s => `[${s.grade}] ${s.id}`).join(", ");
  
  const ticket = {
    id: "TICK-" + Date.now() + Math.floor(Math.random() * 100),
    concertId: state.selectedConcert,
    concertName: concert.name,
    date: state.selectedDate,
    time: state.selectedTime,
    venue: concert.venue,
    poster: concert.poster,
    seats: state.selectedSeats.map(s => ({ id: s.id, grade: s.grade })),
    price: totalAmount,
    bookedAt: new Date().toLocaleString()
  };

  // 회원 프로필 내역에 주입
  if (!state.currentUser.myTickets) {
    state.currentUser.myTickets = [];
  }
  state.currentUser.myTickets.push(ticket);
  
  // 데이터 동기화
  updateUserSession();

  // 4. 예매 성공 모달 내역 렌더링
  renderReceipt(ticket);
  
  // 성공 모달 노출
  document.getElementById("success-modal").classList.add("active");
  showToast("가상 예매가 정상적으로 완료되었습니다!", "success");
}

function renderReceipt(ticket) {
  const container = document.getElementById("receipt-card-container");
  const seatInfos = ticket.seats.map(s => `${s.grade}석 ${s.id}`).join(", ");

  container.innerHTML = `
    <div class="receipt-row">
      <span>예약 번호</span>
      <strong>${ticket.id}</strong>
    </div>
    <div class="receipt-row">
      <span>공연명</span>
      <strong>${ticket.concertName}</strong>
    </div>
    <div class="receipt-row">
      <span>일 시</span>
      <strong>${ticket.date} / ${ticket.time}</strong>
    </div>
    <div class="receipt-row">
      <span>장 소</span>
      <strong>${ticket.venue}</strong>
    </div>
    <div class="receipt-row">
      <span>선택 좌석</span>
      <strong>${seatInfos}</strong>
    </div>
    <hr class="profile-divider" style="margin: 12px 0;">
    <div class="receipt-row">
      <span>최종 결제액</span>
      <strong class="neon-text-cyan" style="font-size: 1.1rem;">${ticket.price.toLocaleString()}원</strong>
    </div>
  `;
}

// ==========================================================================
// [마이페이지 화면 렌더링 & 제어]
// ==========================================================================
function renderMypage() {
  if (!state.currentUser) return;

  // 1. 프로필 정보 갱신
  document.getElementById("mypage-username").textContent = state.currentUser.name;
  document.getElementById("mypage-email").textContent = state.currentUser.email;

  // 2. 팬클럽 멤버십 현황 리스트업
  const membershipContainer = document.getElementById("mypage-membership-status-list");
  membershipContainer.innerHTML = "";

  const memberships = state.currentUser.memberships || {};
  const membershipKeys = Object.keys(memberships);

  if (membershipKeys.length === 0) {
    membershipContainer.innerHTML = `
      <p class="text-muted text-center py-2 text-sm">인증 완료된 멤버십이 없습니다.</p>
    `;
  } else {
    membershipKeys.forEach(key => {
      const data = memberships[key];
      const card = document.createElement("div");
      card.className = "membership-status-badge";
      card.innerHTML = `
        <div class="membership-badge-left">
          <i class="fa-solid fa-award"></i>
          <div class="membership-info-detail">
            <span class="membership-info-name">${data.groupName.split(" - ")[0]} 공식 팬클럽</span>
            <span class="membership-info-gen">${data.fanclubName} 멤버십 (${data.generation}기)</span>
          </div>
        </div>
        <span class="verified-stamp">Verified</span>
      `;
      membershipContainer.appendChild(card);
    });
  }

  // 3. 예매 내역 리스트 렌더링
  const ticketsContainer = document.getElementById("my-tickets-list");
  const countEl = document.getElementById("my-ticket-count");
  const tickets = state.currentUser.myTickets || [];

  countEl.textContent = `${tickets.length}장`;

  if (tickets.length === 0) {
    ticketsContainer.innerHTML = `
      <div class="empty-tickets text-center">
        <i class="fa-solid fa-receipt empty-icon"></i>
        <h3>예매 내역이 없습니다.</h3>
        <p>아티스트의 멤버십 인증을 마친 후 예매를 시작해 보세요!</p>
        <a href="#home" class="btn btn-primary margin-top-md" id="mypage-home-redirect-btn">공연 목록 보러 가기</a>
      </div>
    `;
    
    // 리다이렉트 클릭 감지 추가
    document.getElementById("mypage-home-redirect-btn").addEventListener("click", () => {
      window.location.hash = "#home";
    });
  } else {
    ticketsContainer.innerHTML = "";
    
    // 최근 티켓이 상단에 오도록 역순 루프
    tickets.slice().reverse().forEach(ticket => {
      const card = document.createElement("div");
      card.className = "ticket-card";
      
      const seatsFormatted = ticket.seats.map(s => `${s.grade}석 ${s.id}`).join(", ");

      card.innerHTML = `
        <div class="ticket-poster-side">
          <img src="${ticket.poster}" alt="포스터" class="ticket-poster-img">
        </div>
        <div class="ticket-divider-line"></div>
        <div class="ticket-info-side">
          <div>
            <span class="ticket-artist-tag"><i class="fa-solid fa-star"></i> OFFICIAL TICKET</span>
            <h3 class="ticket-concert-name">${ticket.concertName}</h3>
          </div>
          <div class="ticket-grid-meta">
            <div class="ticket-meta-item">일 시: <strong>${ticket.date} / ${ticket.time}</strong></div>
            <div class="ticket-meta-item">장 소: <strong>${ticket.venue}</strong></div>
            <div class="ticket-meta-item">선택 좌석: <strong>${seatsFormatted}</strong></div>
            <div class="ticket-meta-item">결제액: <strong>${ticket.price.toLocaleString()}원</strong></div>
          </div>
        </div>
        <div class="ticket-cancel-side">
          <i class="fa-solid fa-barcode ticket-barcode"></i>
          <button class="btn-ticket-cancel" data-ticket-id="${ticket.id}">예매 취소</button>
        </div>
      `;

      // 취소 버튼 리스너 바인딩
      card.querySelector(".btn-ticket-cancel").addEventListener("click", () => {
        cancelBooking(ticket.id);
      });

      ticketsContainer.appendChild(card);
    });
  }
}

// 예매 취소 처리
function cancelBooking(ticketId) {
  if (!confirm("선택한 티켓의 예매를 취소하시겠습니까?\n취소 시 확보된 좌석은 즉시 반환됩니다.")) return;

  const ticket = state.currentUser.myTickets.find(t => t.id === ticketId);
  if (!ticket) return;

  // 1. 해당 공연 회차의 예약 완료 좌석 목록에서 삭제 (반환)
  const bookingKey = `ticket_idol_bookings_${ticket.concertId}_${ticket.date}_${ticket.time}`;
  let bookedSeats = JSON.parse(localStorage.getItem(bookingKey) || "[]");

  const seatsToCancel = ticket.seats.map(s => s.id);
  bookedSeats = bookedSeats.filter(seat => !seatsToCancel.includes(seat));

  // 갱신된 예약 완료 좌석 리스트 저장
  localStorage.setItem(bookingKey, JSON.stringify(bookedSeats));

  // 2. 유저 예매 티켓 목록에서 삭제
  state.currentUser.myTickets = state.currentUser.myTickets.filter(t => t.id !== ticketId);

  // 3. 상태 저장 및 마이페이지 리렌더
  updateUserSession();
  showToast("예매가 성공적으로 취소되었습니다.", "info");
  renderMypage();
}

// ==========================================================================
// [데이터 리셋 및 유틸리티]
// ==========================================================================
function resetAllData() {
  if (!confirm("경고: 전체 데이터(회원 정보, 인증 이력, 예매 내역 등)가 전부 초기화되고 페이지가 다시 시작됩니다. 진행하시겠습니까?")) return;

  localStorage.clear();
  showToast("가상 데이터가 모두 삭제되었습니다. 페이지를 리로드합니다.", "info");
  
  setTimeout(() => {
    window.location.hash = "#home";
    window.location.reload();
  }, 1000);
}

// Toast 알림 팝업 띄우기
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  
  toast.className = `toast-message ${type}`;

  // 타입별 아이콘 설정
  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  else if (type === "error") icon = "fa-triangle-exclamation";

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // 3초 후 자동 제거
  setTimeout(() => {
    toast.style.animation = "toastSlideOut 0.3s ease-in forwards";
    // SlideOut CSS 애니메이션 대체용 fade 효과
    toast.style.opacity = "0";
    toast.style.transform = "translateX(120%)";
    toast.style.transition = "all 0.3s ease";
    
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
