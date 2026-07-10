import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

// ⬇️ Firebase 콘솔(https://console.firebase.google.com)에서
//    프로젝트를 만들고 "웹 앱 추가" 후 나오는 설정값을 여기에 붙여넣으세요.
//    (Realtime Database도 콘솔에서 "만들기" 해주셔야 합니다 - 테스트 모드로 시작 가능)
const firebaseConfig = {
  apiKey: "AIzaSyBmGEIFnv5wHoaUkVr_oqDzCrpFy-icOIA",
  authDomain: "emergency-fb919.firebaseapp.com",
  databaseURL: "https://emergency-fb919-default-rtdb.firebaseio.com",
  projectId: "emergency-fb919",
  storageBucket: "emergency-fb919.firebasestorage.app",
  messagingSenderId: "977408024130",
  appId: "1:977408024130:web:dce20d711690c966e9d7db",
  measurementId: "G-JRQ12TD10G",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set };
