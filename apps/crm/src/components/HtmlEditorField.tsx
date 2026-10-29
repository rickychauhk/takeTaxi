import { Input, Tabs, Typography } from 'antd';
import { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type Props = {
  value?: string;
  onChange?: (v: string) => void;
  hint?: string;
};

const toolbar = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ align: [] }],
  [{ color: [] }, { background: [] }],
  ['link'],
  ['blockquote', 'code-block'],
  ['clean'],
];

export default function HtmlEditorField({ value = '', onChange, hint }: Props) {
  const modules = useMemo(() => ({ toolbar }), []);

  return (
    <Tabs
      items={[
        {
          key: 'visual',
          label: '視覺編輯',
          children: (
            <>
              {hint && (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {hint}
                </Typography.Text>
              )}
              <div className="taxima-html-editor">
                <ReactQuill theme="snow" value={value} onChange={onChange} modules={modules} />
              </div>
            </>
          ),
        },
        {
          key: 'source',
          label: 'HTML 原始碼',
          children: (
            <Input.TextArea
              rows={14}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
            />
          ),
        },
        {
          key: 'preview',
          label: 'App 預覽',
          children: (
            <div
              style={{
                minHeight: 280,
                maxHeight: 400,
                overflow: 'auto',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 12,
                background: '#fff',
              }}
              dangerouslySetInnerHTML={{
                __html: value?.trim() || '<p style="color:#999">（尚無內容）</p>',
              }}
            />
          ),
        },
      ]}
    />
  );
}
