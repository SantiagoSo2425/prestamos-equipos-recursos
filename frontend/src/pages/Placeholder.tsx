/** Marcador hasta que la historia correspondiente (Persona A) aporte su página. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <p>Esta pantalla se completa en su historia de usuario.</p>
    </section>
  )
}
