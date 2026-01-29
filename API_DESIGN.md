# OPD Token Allocation System API Design

## Data Models

### Doctor
- id: string
- name: string
- slots: [Slot]

### Slot
- id: string
- doctor_id: string
- start_time: datetime
- end_time: datetime
- max_capacity: int
- tokens: [Token]

### Token
- id: string
- slot_id: string
- patient_id: string
- source: enum (online, walkin, priority, followup, emergency)
- status: enum (allocated, cancelled, no_show, completed)
- priority: int (higher = more priority)
- created_at: datetime

### Patient
- id: string
- name: string
- type: enum (normal, priority, followup)

## API Endpoints

### 1. Create Doctor
- POST /doctors
- Body: { name }
- Response: { doctor }

### 2. Create Slot
- POST /doctors/{doctor_id}/slots
- Body: { start_time, end_time, max_capacity }
- Response: { slot }

### 3. Book Token
- POST /slots/{slot_id}/tokens
- Body: { patient_id, source }
- Response: { token, status }

### 4. Cancel Token
- POST /tokens/{token_id}/cancel
- Response: { success }

### 5. Mark No-Show
- POST /tokens/{token_id}/no_show
- Response: { success }

### 6. Emergency Add
- POST /slots/{slot_id}/emergency
- Body: { patient_id }
- Response: { token, status }

### 7. Get Slot Status
- GET /slots/{slot_id}
- Response: { slot, tokens }

### 8. Simulate OPD Day
- POST /simulate
- Body: { doctors, slots, patients, events }
- Response: { simulation_result }

## Notes
- All endpoints return standard error responses on failure.
- Token allocation enforces slot capacity and prioritization.
- Emergency and priority tokens can preempt lower-priority tokens if slot is full.
