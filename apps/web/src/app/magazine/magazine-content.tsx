import type { WeeklyArticle, WeeklyMagazine, WeeklyPage } from "../../lib/weekly-magazine";

const SECTIONS: Record<string,string> = {
  technology: "Công nghệ", science: "Khoa học", education: "Giáo dục",
  business: "Kinh tế", sports: "Thể thao", general: "Thời sự",
};
export function WeekDate({date}:{date:string}) {
  return <>{new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(date+"T12:00:00+07:00"))}</>;
}
function SourceLink({article}:{article:{url:string;source:string}}) {
  return <a className="wm-source" target="_blank" rel="noopener noreferrer" href={article.url}>{article.source} · Xem tin gốc ↗</a>;
}
function MagazineArticle({article, index}:{article:WeeklyArticle;index:number}) {
  const excerpt=article.editorialSummary || article.summary;
  return <article className="wm-article">
    <span className="wm-eyebrow">{String(index+1).padStart(2,"0")} / {SECTIONS[article.category] ?? "Tin tức"} / {article.coverageDate}</span>
    <h3><a target="_blank" rel="noopener noreferrer" href={article.url}>{article.title}</a></h3>
    <div className="wm-news-byline">{article.source} · Tin từ ngày {article.coverageDate}</div>
    {article.image_url ? <figure className="wm-article-figure">
      <img src={article.image_url} alt={"Ảnh RSS từ " + article.source}
        loading="lazy" onError={e=>{e.currentTarget.style.display="none";}}/>
      <figcaption className="wm-news-caption">Ảnh từ RSS · {article.source}</figcaption>
    </figure> : null}
    <div className="wm-article-body"><p>{excerpt || "Chưa có đoạn mô tả RSS được lưu. Xem bài tại nguồn xuất bản."}</p></div>
    <small className="wm-article-note">{article.editorialSummary ?
      "AI tóm lược từ RSS · kiểm chứng ở nguồn gốc" : "Mô tả RSS · không phải toàn văn"}</small>
    <SourceLink article={article}/>
  </article>;
}
export function MagazinePageContent({page, magazine}:{page:WeeklyPage;magazine:WeeklyMagazine}) {
  if (page.kind==="cover") {
    const lead=magazine.stories[0];
    return <>
      <p className="wm-overline">TẠP CHÍ TIN TỨC CUỐI TUẦN · THE WEEKLY REVIEW</p>
      <h1 className="wm-masthead">NEWS RADAR</h1>
      <div className="wm-masthead-strip"><span>WEEKLY / {magazine.weekStart}</span><span>{magazine.coverageDays}/7 NGÀY CÓ SỐ BÁO</span><span>TẬP {magazine.issueDate}</span></div>
      <div className="wm-cover-layout">
        <section>
          <span className="wm-eyebrow">CÂU CHUYỆN TUẦN NÀY</span>
          <h2 className="wm-cover-headline">{magazine.title}</h2>
          {lead?.image_url ? <img className="wm-cover-photo" src={lead.image_url} alt="" onError={e=>{e.currentTarget.style.display="none"}}/>:null}
          {lead ? <><div className="wm-news-byline">Tin chính · {lead.source} · {lead.coverageDate}</div><h3 className="wm-cover-lead"><a href={lead.url} target="_blank" rel="noopener noreferrer">{lead.title}</a></h3><SourceLink article={lead}/></>:null}
        </section>
        <aside className="wm-cover-aside">
          <span className="wm-eyebrow">LỜI GIỚI THIỆU</span>
          <p>{magazine.overview}</p>
          <div className="wm-small-note">Nội dung từ {magazine.sourceCount} nguồn tin · {magazine.storyCount} câu chuyện được chọn.</div>
          {magazine.coverageDays<7?<div className="wm-warning">Ấn bản tổng hợp chưa đủ 7 ngày. Xem chi tiết ở trang Toàn cảnh tuần.</div>:null}
        </aside>
      </div>
      {magazine.stories.length>1 ? <div className="wm-cover-briefs" aria-label="Các bài khác trong tuần">
        {magazine.stories.slice(1,3).map(article=><article key={article.url}>
          <span className="wm-eyebrow">{SECTIONS[article.category] ?? "Tin tức"}</span>
          <h3><a target="_blank" rel="noopener noreferrer" href={article.url}>{article.title}</a></h3>
          {article.summary ? <p>{article.summary}</p> : null}
          <SourceLink article={article}/>
        </article>)}
      </div> : null}
    </>;
  }
  if (page.kind==="review") return <>
    <div className="wm-inside-head">NEWS RADAR / WEEKLY REVIEW</div>
    <span className="wm-eyebrow">TUẦN {magazine.weekStart} — {magazine.weekEnd}</span>
    <h2 className="wm-section-title">Toàn cảnh tuần qua</h2>
    <p className="wm-review-body">{magazine.overview}</p>
    <div className="wm-week-review-grid">
      {magazine.stories.slice(0,4).map(article=><article key={article.url}>
        <span className="wm-eyebrow">{SECTIONS[article.category] ?? "Tin tức"}</span>
        <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
        <p>{article.editorialSummary || article.summary || "Xem nội dung gốc để biết thêm."}</p>
        <SourceLink article={article}/>
      </article>)}
    </div>
    <p className="wm-review-credit">{magazine.editorial.mode==="ai" ? "Tóm tắt tuần có hỗ trợ AI từ dữ liệu RSS và số báo ngày." : "Tổng hợp từ các số báo ngày đã lưu, dùng RSS fallback."} Không thay thế tin gốc.</p>
    <h3 className="wm-subtitle">Phạm vi dữ liệu</h3>
    <p>Có <strong>{magazine.coverageDays}/7</strong> ngày được tổng hợp; ngày phát hành tập: <WeekDate date={magazine.issueDate}/>.</p>
    <div className="wm-coverage">
      {magazine.availableDates.map(date=><span key={date} className="wm-covered">✓ {date}</span>)}
      {magazine.missingDates.map(date=><span key={date} className="wm-missing">Thiếu {date}</span>)}
    </div>
    <p className="wm-small-note">Các diễn biến được diễn giải theo dữ liệu đã có. Nếu thiếu ngày, tập này không đại diện đầy đủ cho cả tuần.</p>
  </>;
  if (page.kind==="stories") return <>
    <div className="wm-inside-head">NEWS RADAR / WEEKLY / {magazine.weekStart}</div>
    <span className="wm-eyebrow">TỔNG HỢP CHUYÊN MỤC</span>
    <h2 className="wm-section-title">{page.title}</h2>
    <div className="wm-articles">{page.articles.map((article,i)=><MagazineArticle key={article.url} article={article} index={i}/>)}</div>
  </>;
  if (page.kind==="timeline") return <>
    <div className="wm-inside-head">NEWS RADAR / DÒNG THỜI GIAN</div>
    <span className="wm-eyebrow">SỰ KIỆN THEO NGÀY</span>
    <h2 className="wm-section-title">Tuần diễn ra như thế nào?</h2>
    {page.days.length ? <div className="wm-timeline">{page.days.map(day=><section key={day.date}>
      <div className="wm-timeline-date"><WeekDate date={day.date}/></div>
      <div>{day.stories.map(article=><p key={article.url}><a target="_blank" rel="noopener noreferrer" href={article.url}>{article.title}</a><small>{article.source}</small></p>)}</div>
    </section>)}</div>:<p>Chưa có sự kiện được ghi nhận từ các số báo đã lưu.</p>}
    {magazine.missingDates.length>0?<p className="wm-small-note">Ngày chưa có số báo: {magazine.missingDates.join(", ")}.</p>:null}
  </>;
  return <>
    <div className="wm-inside-head">NEWS RADAR / PERSONAL EDITION</div>
    <span className="wm-eyebrow">MY RADAR / DÀNH RIÊNG CHO BẠN</span>
    <h2 className="wm-section-title">Những gì bạn quan tâm</h2>
    <p className="wm-small-note">Tin tuyển chọn thêm theo chủ đề đã lưu trong trình duyệt. Tập tuần gốc không bị thay đổi.</p>
    {!page.enabled?<p>My Radar đang tắt. Bật lại trên trang chủ để có bản tin riêng.</p>:
      page.articles.length ? <div className="wm-articles">{page.articles.map(({article,topic},i)=><article key={article.url} className="wm-article">
        <span className="wm-eyebrow">{String(i+1).padStart(2,"0")} / {topic.toUpperCase()}</span>
        <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
        <div className="wm-article-body"><p>{article.editorialSummary || article.summary || "Đọc thêm tại nguồn tin gốc."}</p></div><SourceLink article={article}/>
      </article>)}</div> : <p>Chưa có thêm bài phù hợp trong tuần này.</p>}
  </>;
}
