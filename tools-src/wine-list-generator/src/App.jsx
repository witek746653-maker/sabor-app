import React, { useState, useEffect } from 'react';
import WineForm from './components/WineForm';
import WineItem from './components/WineItem';
import EditModal from './components/EditModal';

const STORAGE_KEY = 'sabor_wine_generator_data';

function App() {
    const [wines, setWines] = useState([]);
    const [editingWine, setEditingWine] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Load from local storage
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setWines(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load wines", e);
            }
        }
    }, []);

    // Save to local storage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wines));
    }, [wines]);

    const handleAddWine = (newWine) => {
        setWines(prev => [newWine, ...prev]);
    };

    const handleDeleteWine = (id) => {
        if (confirm('Вы уверены, что хотите удалить эту позицию?')) {
            setWines(prev => prev.filter(w => w.id !== id));
        }
    };

    const handleUpdateWine = (id, updatedData) => {
        setWines(prev => prev.map(w => w.id === id ? updatedData : w));
    };

    const openEditModal = (wine) => {
        setEditingWine(wine);
        setIsModalOpen(true);
    };

    const handleSaveEdit = (updatedWine) => {
        handleUpdateWine(updatedWine.id, updatedWine);
    };

    const handleBack = () => {
        window.history.back();
    };

    return (
        <div className="flex flex-col h-full w-full max-w-7xl mx-auto shadow-2xl bg-background-light dark:bg-background-dark">

            {/* Header */}
            <header className="flex-none flex items-center justify-between px-6 py-4 bg-background-light dark:bg-background-dark z-20 border-b border-border-dark/30">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-2xl dark:text-white">arrow_back</span>
                    </button>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight">Генератор вин по бокалам</h1>
                </div>
                <button className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-2xl dark:text-white">more_vert</span>
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* Left Column (Form) */}
                <section className="w-full md:w-5/12 lg:w-4/12 overflow-y-auto no-scrollbar border-r border-border-dark/30 bg-surface-dark/5">
                    <WineForm onAdd={handleAddWine} />
                </section>

                {/* Right Column (List) */}
                <section className="w-full md:w-7/12 lg:w-8/12 overflow-y-auto no-scrollbar bg-background-dark relative">
                    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
                        <div className="flex justify-between items-end border-b border-border-dark/50 pb-4">
                            <h2 className="text-2xl font-bold">Ваш выбор <span className="text-primary text-xl ml-2 font-medium">({wines.length})</span></h2>
                            <button className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-lg">sort</span> Сортировка
                            </button>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {wines.length === 0 && (
                                <div className="col-span-1 xl:col-span-2 text-center py-10 text-white/30">
                                    Список пуст. Добавьте вино слева.
                                </div>
                            )}
                            {wines.map(wine => (
                                <WineItem
                                    key={wine.id}
                                    wine={wine}
                                    onEdit={openEditModal}
                                    onDelete={handleDeleteWine}
                                    onUpdate={handleUpdateWine}
                                />
                            ))}
                        </div>

                        <div className="h-20 md:h-0"></div>
                    </div>
                </section>
            </main>

            <EditModal
                isOpen={isModalOpen}
                wine={editingWine}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEdit}
            />
        </div>
    );
}

export default App;
