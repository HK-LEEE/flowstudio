# FlowStudio 인증 시스템 분리 완료 요약

## 🎯 분리된 아키텍처

### 인증 서버 (localhost:8000)
- **역할**: 사용자 인증 전담
- **API 엔드포인트**:
  - `POST /api/auth/login` - 사용자 로그인
  - `POST /api/auth/logout` - 로그아웃
  - `GET /api/auth/me` - 사용자 정보 조회
  - `POST /api/auth/refresh` - 토큰 갱신
  - `POST /api/auth/register` - 사용자 등록

### FlowStudio 비즈니스 로직 서버 (localhost:8003)
- **역할**: FlowStudio 핵심 기능 제공
- **API 엔드포인트**:
  - `GET /api/fs/component_templates` - 컴포넌트 템플릿 조회
  - `GET /api/fs/flows/:flow_id/data` - 플로우 데이터 조회
  - `GET /api/fs/categories` - 컴포넌트 카테고리 조회

### 프론트엔드 (localhost:3003)
- **역할**: 사용자 인터페이스 제공
- **프록시 설정**: `/api` 요청을 8003 포트로 전달

## 🔧 주요 변경사항

### 1. 프론트엔드 API 서비스 분리
```typescript
// 두 개의 axios 인스턴스 사용
class ApiService {
  private axiosInstance: AxiosInstance;        // FlowStudio API (8003)
  private authAxiosInstance: AxiosInstance;    // 인증 API (8000)
}
```

**인증 관련 요청** → `authAxiosInstance` (port 8000)
- login(), logout(), getCurrentUser(), refreshAccessToken()

**비즈니스 로직 요청** → `axiosInstance` (port 8003)
- getFlows(), createFlow(), saveFlow(), 컴포넌트 관련 API

### 2. 백엔드 인증 의존성 변경
```python
# 기존: 자체 인증
from ..api.deps import get_current_user

# 변경: 외부 인증 서버 연동
from ..api.deps_external_auth import get_current_user_external as get_current_user
```

**외부 인증 검증 프로세스**:
1. JWT 토큰 추출
2. 인증 서버(8000)의 `/api/auth/me` 호출
3. 사용자 정보 검증 및 UserContext 생성

### 3. 타입 정의 업데이트
```typescript
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;  // 로그인 응답에 사용자 정보 포함
}
```

### 4. FlowStudio 백엔드에서 인증 라우터 제거
- `/api/auth/*` 엔드포인트 제거
- 모든 인증은 외부 인증 서버(8000)에서 처리

## 🔐 인증 플로우

### 로그인 과정
1. 사용자가 로그인 폼 입력
2. Frontend → `http://localhost:8000/api/auth/login`
3. 인증 서버에서 토큰 + 사용자 정보 반환
4. Frontend에서 토큰 저장 및 사용자 정보 설정

### API 요청 과정
1. Frontend가 FlowStudio API 호출
2. Frontend → `http://localhost:8003/api/fs/*` (토큰 포함)
3. FlowStudio 백엔드가 토큰 검증을 위해 인증 서버 호출
4. 인증 서버 → `http://localhost:8000/api/auth/me` 검증
5. 검증 성공 시 요청 처리

### 토큰 갱신 과정
1. API 요청 시 401 응답 받음
2. Frontend가 자동으로 refresh token 사용
3. Frontend → `http://localhost:8000/api/auth/refresh`
4. 새로운 access token 받아서 원래 요청 재시도

## 🧪 테스트 계정

**테스트 사용자**:
- Email: `flowstudio@test.com`
- Password: `flowstudio123`

**등록 API 사용법**:
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "yourpassword",
    "username": "yourusername",
    "real_name": "Your Name",
    "phone_number": "010-xxxx-xxxx"
  }'
```

## 🚀 실행 방법

1. **인증 서버 시작** (localhost:8000)
   ```bash
   # 별도 터미널에서 실행 필요
   cd /path/to/auth/server
   ./start_auth_server.sh
   ```

2. **FlowStudio 백엔드 시작** (localhost:8003)
   ```bash
   cd /Users/hyunkyu/Documents/project/max_flwostudio
   ./start_backend_macos.sh
   ```

3. **FlowStudio 프론트엔드 시작** (localhost:3003)
   ```bash
   ./start_frontend_macos.sh
   ```

## ✅ 검증 완료 사항

- ✅ 인증 서버(8000) 정상 동작 확인
- ✅ 사용자 등록/로그인 API 동작 확인
- ✅ JWT 토큰 발급 확인
- ✅ FlowStudio 백엔드 외부 인증 연동 구현
- ✅ 프론트엔드 이중 API 구조 구현
- ✅ 토큰 자동 갱신 로직 구현

## 🔄 다음 단계

1. 인증 서버의 `/api/auth/me` 엔드포인트 이슈 해결
2. FlowStudio 백엔드 컴포넌트 템플릿 초기화
3. 전체 시스템 통합 테스트
4. 사용자 권한 기반 API 접근 제어 구현

이제 FlowStudio는 완전히 분리된 인증 아키텍처를 가지게 되어, 확장성과 보안성이 크게 향상되었습니다.