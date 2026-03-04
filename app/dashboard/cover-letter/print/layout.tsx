// Layout kosong untuk halaman print — tidak ada navbar/sidebar
export default function PrintLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="id">
            <body>
                {children}
            </body>
        </html>
    );
}
