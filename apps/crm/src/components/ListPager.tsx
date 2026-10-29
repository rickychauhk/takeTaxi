import { Button, Space, Typography } from 'antd';

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
};

export default function ListPager({ page, totalPages, total, pageSize = 10, onChange }: Props) {
  return (
    <Space style={{ marginTop: 16, width: '100%', justifyContent: 'space-between' }} wrap>
      <Typography.Text type="secondary">
        共 {total} 筆 · 第 {page} / {totalPages} 頁（每頁最多 {pageSize} 筆）
      </Typography.Text>
      <Space>
        <Button disabled={page <= 1} onClick={() => onChange(page - 1)}>
          上一頁
        </Button>
        <Button disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          下一頁
        </Button>
      </Space>
    </Space>
  );
}
