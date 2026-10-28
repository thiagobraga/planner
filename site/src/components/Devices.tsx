export function Laptop() {
  return (
    <div className="mx-auto w-full">
      <div className="rounded-t-2xl border border-[#2c2c28] bg-[#2c2c28] p-2 shadow-[0_30px_80px_-20px_rgba(44,44,40,.45)] sm:p-3">
        <img src="/screens/desktop.png" alt="Planner daily list on a laptop" className="aspect-[16/10] w-full rounded-md object-cover object-top" />
      </div>
      <div className="relative mx-[-4%] h-3 rounded-b-xl bg-gradient-to-b from-[#d9d4cb] to-[#b8b2a8] sm:h-4">
        <div className="absolute top-0 left-1/2 h-1.5 w-1/6 -translate-x-1/2 rounded-b-md bg-[#a8a298]" />
      </div>
    </div>
  );
}

export function Tablet() {
  return (
    <div className="rounded-[1.6rem] bg-[#2c2c28] p-2.5 shadow-[0_30px_60px_-20px_rgba(44,44,40,.5)]">
      <img src="/screens/tablet.png" alt="Planner monthly view on a tablet" className="aspect-[3/4] w-full rounded-[1.1rem] object-cover object-top" />
    </div>
  );
}

export function Phone() {
  return (
    <div className="rounded-[2.2rem] bg-[#2c2c28] p-2 shadow-[0_30px_60px_-15px_rgba(44,44,40,.55)]">
      <img src="/screens/phone.png" alt="Planner daily list on a phone" className="aspect-[9/19.5] w-full rounded-[1.7rem] object-cover object-top" />
    </div>
  );
}
