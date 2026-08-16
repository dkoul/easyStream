import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <p className="kicker">easyStream</p>
      <h1>Be there, even when you can&apos;t be there.</h1>
      <p className="promise">
        Share a family event from a phone. Relatives open a WhatsApp link and
        watch inside a personal invitation — no app, no account, no fuss.
      </p>
      <div className="cta">
        <Link className="btn btn-primary" href="/studio">
          Create an event
        </Link>
        <a className="btn btn-ghost" href="https://github.com/dkoul/easyStream">
          How it works
        </a>
      </div>
    </main>
  );
}
