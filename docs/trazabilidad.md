# Trazabilidad CA → RF → US → implementación → PR → PF

> Cada persona edita solo sus filas. Los números de PR se completan al abrirlos.

| CA | RF | US | Implementación | PR | Prueba |
|---|---|---|---|---|---|
| CA-03 Evaluación | RF-18…21 | US3 | `services/loan_workflow.py` (`approve_loan`, `reject_loan`), `services/rules.py`, `domain/loan_states.py`, `api/loans.py` (`/approve`, `/reject`), `pages/review/ReviewInboxPage.tsx` | _pendiente_ | PF-05, PF-06 |
| CA-04 Entrega | RF-22…25 | US4 | `loan_workflow.deliver_loan`, restricción `loans_no_overlap` (`alembic/versions/0001_initial.py`), `pages/loans/LoanDetailPage.tsx`, `DeliverForm.tsx` | _pendiente_ | PF-07, PF-08, PF-09 |
| CA-05 Devolución e historial | RF-26…30 | US5 | `loan_workflow.return_loan`, `services/movements.py`, `pages/loans/ReturnForm.tsx` | _pendiente_ | PF-10 |
