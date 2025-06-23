# FlowStudio 최종 기능 개발 마일스톤 및 상세 구현 명세 (v4.0 - MCP Context7 통합 최종본)

## 서문 (Preamble)

본 문서는 **기존에 개발된 Python/FastAPI 백엔드와 React 프론트엔드 및 JWT 인증 시스템을 기반으로**, MCP (Model Context Protocol) context7의 최신 아키텍처와 패턴을 적용하여 'FlowStudio'의 핵심 기능을 개발하기 위한 **최종 기술 로드맵이자 상세 구현 명세서**입니다. 개발팀은 이미 구축된 코드베이스 위에 새로운 기능을 점진적으로 구현해 나가며, 본 문서를 개발의 "Single Source of Truth"로 사용합니다.

### 중요 환경 정보
- **FlowStudio 인증 서버**: `localhost:8000` (별도 운영)
- **FlowStudio 애플리케이션**: `localhost:8003` (개발 예정)
- **현재 구축된 기반**: JWT 인증, Zustand 상태관리, React Flow 통합 준비 완료

### 주요 기술 스택 및 라이브러리 (MCP Context7 기반)

#### Frontend Technology Stack
- **Core Framework**: `React 18` + `TypeScript` + `Vite`
- **Visual Canvas**: `ReactFlow` (핵심 캔버스 엔진)
- **State Management**: `Zustand` (클라이언트 상태 관리)
- **API Communication**: `Axios` (HTTP 클라이언트)
- **MCP Integration**: MCP Client Framework
- **Authentication**: JWT + OIDC integration
- **Real-time**: WebSocket + Server-Sent Events (SSE)
- **UI Framework**: Ant Design (현재 로그인 페이지에서 사용 중)

#### Backend Technology Stack
- **Core Framework**: `FastAPI` (Python 3.11+)
- **Database ORM**: `SQLAlchemy` (async)
- **Data Validation**: `Pydantic` v2
- **Protocol Foundation**: JSON-RPC 2.0 (MCP 표준)
- **MCP Integration**: MCP Server Framework
- **Authentication**: JWT + OAuth PKCE + OIDC
- **Real-time**: WebSocket + HTTP SSE
- **Transport Layers**: stdio, WebSockets, HTTP SSE
- **Security**: Prompt injection protection, OAuth flows

#### MCP Context7 Integration Components
- **Tools**: Model-controlled executable functions
- **Resources**: Application-controlled context data
- **Prompts**: User-controlled interaction templates
- **Dynamic Discovery**: Runtime capability detection
- **Bidirectional Communication**: Persistent context-aware dialogue

### 참고 아키텍처 및 표준
- **Primary Reference**: `Langflow` (컴포넌트 구조, 실행 로직, UX/UI 기능)
- **Protocol Standard**: MCP (Model Context Protocol) context7
- **Security Standard**: OWASP security practices
- **IDE Integration**: VS Code, Cursor, Windsurf compatibility

---

## 마일스톤 0: MCP 기반 인증 및 초기 환경 설정 (MCP Authentication & Initial Setup)

**목표:** FlowStudio 애플리케이션에 MCP context7 표준을 적용한 보안 강화 인증 시스템을 구현하고, 외부 인증 서버(`localhost:8000`)와의 연동을 완료합니다.

### 주요 과업 (Tasks)

#### 1. Backend (MCP 기반 인증 아키텍처)
**과업 0.1:** MCP 서버 프레임워크 통합 및 인증 강화
- **설명:** 기존 FastAPI 백엔드에 MCP Server Framework를 통합하고, JWT + OIDC + OAuth PKCE 플로우를 구현합니다.
- **구현 요소:**
  - JSON-RPC 2.0 기반 프로토콜 레이어 추가
  - MCP 인증 제공자 구현 (`JWTAuthProvider`, `OIDCAuthProvider`)
  - 프롬프트 인젝션 보호 메커니즘 구현
  - 멀티테넌트 보안 아키텍처 적용

**과업 0.2:** 외부 인증 서버(localhost:8000) MCP 연동
- **설명:** FlowStudio 백엔드(`localhost:8003`)와 외부 인증 서버 간 MCP 프로토콜 기반 통신 구현
- **구현 예시:**
```python
import { JWTAuthProvider } from "@modelcontextprotocol/mcp-framework"

auth_provider = JWTAuthProvider({
    secret: "flowstudio-jwt-secret",
    algorithms: ["HS256", "RS256"],
    header_name: "Authorization",
    require_bearer: True,
    oidc_discovery_url: "http://localhost:8000/.well-known/openid_configuration"
})
```

#### 2. Frontend (MCP 클라이언트 통합)
**과업 0.3:** MCP 클라이언트 기반 로그인 시스템 구현
- **설명:** 기존 로그인 페이지를 MCP 클라이언트 패턴으로 업그레이드하고 OAuth PKCE 플로우 지원
- **기존 구현 기반 확장:**
  - 현재의 Ant Design 기반 로그인 UI 유지
  - MCP 클라이언트 라이브러리 통합
  - OAuth PKCE 플로우 구현
  - 실시간 인증 상태 동기화 (WebSocket)

**과업 0.4:** 향상된 라우트 보호 및 세션 관리
- **설명:** MCP 표준에 따른 상태 기반 라우트 보호 및 컨텍스트 인식 세션 관리 구현
- **구현 요소:**
  - 기존 `PrivateRoute` 컴포넌트 MCP 호환성 확장
  - 실시간 권한 검증 (WebSocket 기반)
  - 컨텍스트 인식 리다이렉션 로직

#### 3. 개발 환경 설정 업데이트
**과업 0.5:** MCP 개발 환경 구성 및 스크립트 업데이트
- **설명:** 기존 개발 스크립트를 MCP 환경에 맞게 업데이트하고 새로운 포트 구성 적용
- **환경 구성:**
  - 인증 서버: `localhost:8000` (기존 유지)
  - FlowStudio 앱: `localhost:8003` (포트 변경)
  - MCP 서버: stdio/WebSocket transport 지원
  - 개발 스크립트 업데이트 (`start_all_services_macos.sh` 등)

---

## 마일스톤 1: MCP 서버/클라이언트 아키텍처 구축 (MCP Architecture Foundation)

**목표:** MCP context7의 핵심 아키텍처인 Tools, Resources, Prompts 시스템을 구현하고, 동적 디스커버리 패턴을 통해 컴포넌트 시스템의 기초를 구축합니다.

### 주요 과업 (Tasks)

#### 1. Backend (MCP 서버 구현)
**과업 1.1:** MCP Tools, Resources, Prompts 시스템 구현
- **설명:** FlowStudio 컴포넌트를 MCP의 3대 핵심 요소로 매핑하여 구현
- **구현 구조:**
```python
# MCP Tool Interface
class FlowStudioTool:
    name: str
    description: str
    input_schema: Dict[str, Any]  # JSON Schema
    
# MCP Resource Interface  
class FlowStudioResource:
    uri: str
    name: str
    mime_type: str
    
# MCP Prompt Interface
class FlowStudioPrompt:
    name: str
    description: str
    arguments: List[PromptArgument]
```

**과업 1.2:** 동적 디스커버리 시스템 구현
- **설명:** MCP 표준에 따른 런타임 capability 발견 시스템 구현
- **API 엔드포인트:**
  - `GET /api/mcp/capabilities` - 서버 capabilities 반환
  - `GET /api/mcp/tools` - 사용 가능한 도구 목록
  - `GET /api/mcp/resources` - 리소스 목록
  - `GET /api/mcp/prompts` - 프롬프트 템플릿 목록

**과업 1.3:** 데이터베이스 스키마 확장 (MCP 호환)
- **설명:** 기존 데이터베이스 스키마를 MCP 표준에 맞게 확장
- **새로운 테이블:**
```sql
-- MCP 컴포넌트 템플릿 (기존 확장)
ALTER TABLE flow_studio_component_templates ADD COLUMN mcp_tool_schema JSONB;
ALTER TABLE flow_studio_component_templates ADD COLUMN mcp_resource_uri VARCHAR(512);
ALTER TABLE flow_studio_component_templates ADD COLUMN transport_type VARCHAR(50) DEFAULT 'stdio';

-- MCP 세션 관리
CREATE TABLE mcp_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    client_info JSONB,
    capabilities JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW()
);
```

#### 2. Frontend (MCP 클라이언트 구현)
**과업 2.1:** MCP 클라이언트 통합 및 캔버스 구현
- **설명:** ReactFlow를 MCP 클라이언트와 통합하여 동적 컴포넌트 렌더링 시스템 구현
- **구현 요소:**
  - MCP 클라이언트 초기화 및 handshake 처리
  - 동적 도구 발견 및 UI 렌더링
  - 실시간 capability 업데이트 (WebSocket)

**과업 2.2:** 컴포넌트 라이브러리 (MCP Tools 기반)
- **설명:** MCP Tools를 기반으로 한 동적 컴포넌트 라이브러리 구현
- **컴포넌트 카테고리 (MCP context7 기반):**
  - **Input Tools**: `Chat Input`, `Text Input`, `File Input`, `MCP Resource Input`
  - **Output Tools**: `Chat Output`, `Text Output`, `File Output`, `MCP Response Output`
  - **LLM Tools**: `AzureOpenAI`, `Ollama`, `Google Vertex AI`, `Anthropic Claude`
  - **MCP Integration Tools**: `MCP Server Connector`, `MCP Resource Fetcher`
  - **RAG Tools**: Enhanced with MCP resource discovery
  - **Logic Tools**: `Conditional Flow`, `MCP Tool Executor`, `Context Switch`

#### 3. MCP 프로토콜 레이어 구현
**과업 2.3:** JSON-RPC 2.0 통신 레이어
- **설명:** MCP 표준에 따른 JSON-RPC 2.0 기반 통신 시스템 구현
- **구현 요소:**
  - Request/Response correlation 처리
  - Error handling 및 standardized error reporting
  - Bidirectional message handling
  - Multiple transport support (WebSocket, SSE, stdio)

---

## 마일스톤 2: 동적 컴포넌트 디스커버리 시스템 (Dynamic Component Discovery)

**목표:** MCP의 동적 디스커버리 패턴을 활용하여 사용자가 실시간으로 새로운 컴포넌트를 발견하고 플로우에 통합할 수 있는 시스템을 구현합니다.

### 주요 과업 (Tasks)

#### 1. Frontend (인터랙티브 에디터)
**과업 3.1:** MCP 기반 노드 시스템 구현
- **설명:** MCP Tool을 기반으로 한 동적 노드 생성 및 관리 시스템
- **구현 요소:**
```typescript
interface MCPNodeData {
  mcp_tool_id: string;
  tool_schema: MCPToolSchema;
  dynamic_capabilities: string[];
  real_time_updates: boolean;
}

class FS_MCPNode extends React.Component<NodeProps<MCPNodeData>> {
  // MCP Tool 기반 동적 포트 생성
  // 실시간 capability 업데이트 처리
  // Context-aware input validation
}
```

**과업 3.2:** 실시간 MCP 엣지 시스템
- **설명:** MCP 프로토콜의 양방향 통신을 활용한 지능형 엣지 연결 시스템
- **Enhanced Edge Features:**
```typescript
interface MCPEdgeData {
  protocol_version: string;
  context_flow: ContextFlowData;
  real_time_validation: boolean;
  data_inspector: DataInspectorConfig;
}

class FS_MCPEdge extends React.Component<EdgeProps> {
  // 실시간 타입 검증 (MCP Tools 기반)
  // Context-aware data flow 시각화
  // Live data inspection 기능
}
```

#### 2. Backend (MCP 서버 확장)
**과업 4.1:** 상태 관리 및 세션 지속성
- **설명:** MCP의 stateful server capabilities를 활용한 플로우 상태 관리
- **구현 요소:**
  - 세션 기반 플로우 상태 관리
  - Context-aware state transitions
  - Real-time state synchronization

**과업 4.2:** MCP Resource 통합
- **설명:** 외부 MCP 서버의 리소스를 FlowStudio 컴포넌트로 동적 통합
- **API 확장:**
```python
@router.post("/api/mcp/integrate-resource")
async def integrate_mcp_resource(
    resource_uri: str,
    mcp_server_endpoint: str,
    user_context: UserContext = Depends(get_current_user)
):
    # MCP 서버에서 리소스 발견
    # 동적 컴포넌트 생성
    # 사용자 워크스페이스에 통합
```

#### 3. 고급 UI/UX 기능
**과업 5.1:** MCP Context Inspector
- **설명:** MCP 컨텍스트와 메타데이터를 실시간으로 시각화하는 고급 디버깅 도구
- **기능:**
  - Real-time MCP message flow visualization
  - Context history and state inspection
  - Tool execution trace viewer

**과업 5.2:** 다중 MCP 서버 관리
- **설명:** 여러 MCP 서버를 동시에 연결하고 관리하는 시스템
- **UI 요소:**
  - MCP 서버 연결 상태 표시
  - 서버별 capability 목록
  - 서버 간 컨텍스트 공유 설정

---

## 마일스톤 3: 실시간 실행 엔진 및 스트리밍 (Real-time Execution Engine & Streaming)

**목표:** MCP의 실시간 양방향 통신과 스트리밍 capabilities를 활용하여 고성능 플로우 실행 엔진을 구축합니다.

### 주요 과업 (Tasks)

#### 1. Backend (MCP 기반 실행 엔진)
**과업 6.1:** MCP 실행 엔진 구현 (`FS_MCPExecutor`)
- **설명:** MCP 표준에 따른 context-aware 실행 엔진 구현
```python
class FS_MCPExecutor:
    def __init__(self, mcp_session: MCPSession, flow_data: FlowData):
        self.mcp_client = MCPClient(session)
        self.context_manager = ContextManager()
        self.execution_graph = self.build_mcp_graph(flow_data)
    
    async def execute_flow(self, initial_context: Dict[str, Any]):
        # MCP Tool 기반 노드 실행
        # Context propagation 및 scope 관리
        # Real-time execution status streaming
        # Error handling 및 recovery
```

**과업 6.2:** 스트리밍 및 실시간 피드백
- **설명:** WebSocket과 SSE를 활용한 실시간 실행 피드백 시스템
- **구현 요소:**
  - Real-time execution status streaming
  - Live output streaming (특히 LLM responses)
  - Context-aware progress tracking
  - Multi-client execution monitoring

**과업 6.3:** MCP Tool Invocation 시스템
- **설명:** MCP 표준에 따른 도구 호출 및 결과 처리 시스템
- **실행 흐름:**
```python
async def invoke_mcp_tool(self, tool_name: str, parameters: Dict[str, Any]):
    # Tool discovery 및 validation
    # Parameter schema validation
    # Context injection 및 execution
    # Result processing 및 context update
    # Real-time status reporting
```

#### 2. Frontend (실시간 UI)
**과업 7.1:** 실시간 실행 시각화
- **설명:** MCP 실행 상태를 실시간으로 시각화하는 고급 UI 시스템
- **기능:**
  - Node execution state indicators (waiting, running, completed, error)
  - Real-time data flow animation
  - Context propagation visualization
  - Live performance metrics

**과업 7.2:** 스트리밍 채팅 인터페이스
- **설명:** LLM 응답의 실시간 스트리밍을 지원하는 채팅 인터페이스
- **구현 요소:**
  - Token-by-token streaming display
  - Streaming progress indicators
  - Context-aware response formatting
  - Multi-turn conversation support

#### 3. 고급 실행 기능
**과업 8.1:** MCP 디버깅 모드
- **설명:** MCP 컨텍스트를 활용한 고급 디버깅 기능
- **기능:**
  - Step-by-step execution with MCP context inspection
  - Breakpoint 설정 및 상태 검사
  - Context modification 및 실행 재개
  - Tool execution trace analysis

**과업 8.2:** 병렬 실행 및 최적화
- **설명:** MCP의 비동기 특성을 활용한 병렬 실행 최적화
- **구현 요소:**
  - Parallel node execution where possible
  - Resource pooling 및 connection reuse
  - Context caching 및 optimization
  - Performance monitoring 및 analytics

---

## 마일스톤 4: IDE 통합 및 개발자 도구 (IDE Integration & Developer Tools)

**목표:** MCP context7의 IDE 통합 표준을 따라 VS Code, Cursor, Windsurf 등 주요 IDE와의 원활한 통합을 구현합니다.

### 주요 과업 (Tasks)

#### 1. IDE 통합 개발
**과업 9.1:** VS Code Extension 개발
- **설명:** FlowStudio를 VS Code 내에서 직접 사용할 수 있는 확장 개발
- **기능:**
  - Flow editor 내장
  - MCP server 자동 발견 및 연결
  - Context-aware code completion
  - Real-time collaboration

**과업 9.2:** Cursor 및 Windsurf 지원
- **설명:** 최신 AI-powered IDE들과의 호환성 구현
- **구현 요소:**
  - MCP client integration
  - AI assistant context sharing
  - Flow-to-code generation
  - Code-to-flow reverse engineering

#### 2. 개발자 도구 확장
**과업 10.1:** MCP Registry 통합
- **설명:** 중앙 MCP 서버 레지스트리와의 통합으로 컴포넌트 생태계 확장
- **기능:**
  - Public MCP server discovery
  - Community component sharing
  - Version management 및 updates
  - Security scanning 및 validation

**과업 10.2:** FlowStudio CLI 도구
- **설명:** 명령줄에서 FlowStudio를 조작할 수 있는 CLI 도구 개발
```bash
# FlowStudio CLI 사용 예시
flowstudio create --template="chat-bot" --name="my-assistant"
flowstudio run --flow-id="abc123" --input='{"message": "Hello"}'
flowstudio deploy --flow-id="abc123" --version="1.0.0"
flowstudio mcp list-servers
flowstudio mcp connect --server-url="https://example.com/mcp"
```

---

## 마일스톤 5: 엔터프라이즈 보안 및 스케일링 (Enterprise Security & Scaling)

**목표:** MCP의 보안 표준과 엔터프라이즈 요구사항을 충족하는 스케일러블한 플랫폼을 구축합니다.

### 주요 과업 (Tasks)

#### 1. 고급 보안 구현
**과업 11.1:** 엔터프라이즈 인증 시스템
- **설명:** SAML, LDAP, SSO 통합을 통한 엔터프라이즈급 인증 시스템
- **구현 요소:**
```python
# 엔터프라이즈 인증 제공자
class EnterpriseAuthProvider:
    def __init__(self):
        self.saml_provider = SAMLAuthProvider()
        self.ldap_provider = LDAPAuthProvider()
        self.oidc_provider = OIDCAuthProvider()
    
    async def authenticate(self, auth_method: str, credentials: Dict):
        # Multi-factor authentication
        # Role-based access control
        # Audit logging
```

**과업 11.2:** 보안 스캐닝 및 컴플라이언스
- **설명:** MCP Tool 및 Resource에 대한 자동 보안 스캐닝 시스템
- **기능:**
  - Automated security vulnerability scanning
  - Code injection prevention
  - Data privacy compliance (GDPR, HIPAA)
  - Audit trail 및 compliance reporting

#### 2. 플로우 게시 및 API 배포 (MCP 표준)
**과업 12.1:** MCP 호환 API 게시 시스템
- **설명:** MCP 표준을 따르는 API 엔드포인트 자동 생성 및 배포
- **게시 프로세스:**
```python
# MCP 호환 플로우 게시
@router.post("/api/mcp/publish-flow")
async def publish_flow_as_mcp_server(
    flow_id: str,
    version: str,
    mcp_config: MCPServerConfig
):
    # Flow를 MCP Server로 변환
    # Automatic API documentation generation
    # OpenAPI 3.0 + MCP schema 생성
    # Container 배포 및 scaling
```

**과업 12.2:** 마이크로서비스 아키텍처
- **설명:** 각 게시된 플로우를 독립적인 MCP 서버로 배포
- **구현 요소:**
  - Docker containerization
  - Kubernetes orchestration
  - Auto-scaling 및 load balancing
  - Service mesh integration

#### 3. 모니터링 및 운영
**과업 13.1:** 고급 모니터링 시스템
- **설명:** MCP 서버 및 플로우 실행에 대한 종합적인 모니터링
- **메트릭:**
  - MCP message throughput 및 latency
  - Tool execution success rates
  - Resource utilization
  - User engagement analytics

**과업 13.2:** 자동화된 운영 도구
- **설명:** MCP 기반 플랫폼의 자동화된 운영 및 유지보수
- **기능:**
  - Automated backup 및 disaster recovery
  - Performance optimization recommendations
  - Predictive scaling
  - Automated security updates

---

## 기술 구현 가이드라인

### MCP Context7 Best Practices
1. **Interoperability**: Universal MCP client-server communication rules 준수
2. **Security-First**: JWT, OIDC, OAuth PKCE 표준 구현
3. **Real-time Architecture**: WebSocket 및 SSE 기반 실시간 통신
4. **Component Modularity**: 각 기능을 독립적인 MCP Tool로 구현
5. **Type Safety**: Pydantic v2 + TypeScript strict mode
6. **Developer Experience**: Clear structure and standardized approach

### 성능 최적화 전략
- **Connection Pooling**: MCP 서버 연결 재사용
- **Context Caching**: 자주 사용되는 컨텍스트 캐싱
- **Lazy Loading**: 필요시에만 MCP Tool 로드
- **Streaming Optimization**: 대용량 데이터 스트리밍 최적화

### 보안 구현 요구사항
- **Zero Trust Architecture**: 모든 MCP 통신에 대한 인증/인가
- **Data Encryption**: 전송 중 및 저장 중 데이터 암호화
- **Audit Logging**: 모든 MCP 작업에 대한 상세 로그
- **Rate Limiting**: API 호출 제한 및 DDoS 보호

---

## 결론

본 로드맵은 MCP context7의 최신 표준을 완전히 반영하여 FlowStudio를 차세대 AI 개발 플랫폼으로 발전시키기 위한 종합적인 가이드입니다. 각 마일스톤은 순차적으로 진행되며, 개발팀은 이 문서를 기준으로 상세한 구현을 진행해야 합니다.

특히 MCP의 핵심 가치인 **상호 운용성(Interoperability)**, **개발자 친화성(Developer-Friendly)**, **확장성(Extensibility)**을 모든 구현 과정에서 최우선으로 고려해야 합니다.

이 로드맵을 통해 FlowStudio는 OpenAI, Google DeepMind, Microsoft 등 주요 AI 플랫폼과 호환되는 표준 기반의 현대적인 AI 개발 환경을 제공할 수 있을 것입니다.