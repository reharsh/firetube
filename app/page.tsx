import { Input } from "@/components/input";
import { HeroGeometric } from "@/components/landing";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex items-center justify-center h-screen">
      <HeroGeometric badge="newly launched" title1="Convert anything into" title2="Fireship videos"/>
    </div>
  );
}
