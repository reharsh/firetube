import { create } from "zustand";

type TitleStore = {
    title: string;
    setTitle: (title: string) => void;
}

const useTitleStore = create<TitleStore>((set) => ({
    title: "",
    setTitle: (title: string) => set({ title }),
}));

export default useTitleStore;
