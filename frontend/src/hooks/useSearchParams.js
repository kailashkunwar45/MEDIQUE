import { useSearchParams as useSearchParamsRR } from 'react-router-dom';
export function useSearchParams() {
    const [searchParams] = useSearchParamsRR();
    return searchParams;
}
