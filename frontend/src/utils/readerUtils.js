export const cn = (...classes) => classes.filter(Boolean).join(' ');

// Заглушка для toast, так как в проекте используется свой ToastContext
export const toast = (options) => {
    console.log('Toast:', options.title, options.description);
    // В реальных компонентах мы будем использовать useToast() из контекста
};
