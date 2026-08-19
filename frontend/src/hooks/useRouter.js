import { useNavigate } from 'react-router-dom';
export function useRouter() {
    const navigate = useNavigate();
    return {
        push: (path) => navigate(path),
        replace: (path) => navigate(path, { replace: true }),
        back: () => navigate(-1),
    };
}
