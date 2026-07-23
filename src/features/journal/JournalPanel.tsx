import { useState } from 'react'
import { useAppDispatch } from '../../store/hooks'
import { deleteOperation } from '../../store/dataSlice'
import JournalGrid from './JournalGrid'
import OperationForm from './OperationForm'

export default function JournalPanel() {
  const dispatch = useAppDispatch()
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="panel">
      <div className="toolbar">
        <button className="btn btn--primary" onClick={() => setFormOpen(true)}>+ Операция</button>
        <button
          className="btn btn--danger"
          disabled={!selected}
          onClick={() => { if (selected) { dispatch(deleteOperation(selected)); setSelected(null) } }}
        >
          Удалить выбранную
        </button>
        <span className="toolbar__hint">Клик по строке — выбор для удаления</span>
      </div>
      <div className="panel__grid">
        <JournalGrid onSelect={setSelected} />
      </div>
      {formOpen && <OperationForm onClose={() => setFormOpen(false)} />}
    </div>
  )
}
